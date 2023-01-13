'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var fs = require('fs');
var path = require('path');
var esbuild = require('esbuild');
var loaderUtils = require('loader-utils');
var JoyCon = require('joycon');
var JSON5 = require('json5');
var module$1 = require('module');
var webpackSources = require('webpack-sources');
var ModuleFilenameHelpers_js = require('webpack/lib/ModuleFilenameHelpers.js');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var path__default = /*#__PURE__*/_interopDefaultLegacy(path);
var JoyCon__default = /*#__PURE__*/_interopDefaultLegacy(JoyCon);
var JSON5__default = /*#__PURE__*/_interopDefaultLegacy(JSON5);

const joycon = new JoyCon__default["default"]();
joycon.addLoader({
  test: /\.json$/,
  async load(filePath) {
    try {
      const config = fs__default["default"].readFileSync(filePath, "utf8");
      return JSON5__default["default"].parse(config);
    } catch (error) {
      throw new Error(
        `Failed to parse tsconfig at ${path__default["default"].relative(process.cwd(), filePath)}: ${error.message}`
      );
    }
  }
});
const isTsExtensionPtrn = /\.ts$/i;
let tsConfig;
async function ESBuildLoader(source) {
  var _a, _b, _c;
  const done = this.async();
  const options = loaderUtils.getOptions(this);
  const {
    implementation,
    ...esbuildTransformOptions
  } = options;
  if (implementation && typeof implementation.transform !== "function") {
    done(
      new TypeError(
        `esbuild-loader: options.implementation.transform must be an ESBuild transform function. Received ${typeof implementation.transform}`
      )
    );
    return;
  }
  const transform = (_a = implementation == null ? void 0 : implementation.transform) != null ? _a : esbuild.transform;
  const transformOptions = {
    ...esbuildTransformOptions,
    target: (_b = options.target) != null ? _b : "es2015",
    loader: (_c = options.loader) != null ? _c : "js",
    sourcemap: this.sourceMap,
    sourcefile: this.resourcePath
  };
  if (!("tsconfigRaw" in transformOptions)) {
    if (!tsConfig) {
      tsConfig = await joycon.load(["tsconfig.json"]);
    }
    if (tsConfig.data) {
      transformOptions.tsconfigRaw = tsConfig.data;
    }
  }
  if (transformOptions.loader === "tsx" && isTsExtensionPtrn.test(this.resourcePath)) {
    transformOptions.loader = "ts";
  }
  try {
    const { code, map } = await transform(source, transformOptions);
    done(null, code, map && JSON.parse(map));
  } catch (error) {
    done(error);
  }
}

class ESBuildPlugin {
  apply() {
    console.warn("[esbuild-loader] ESBuildPlugin is no longer required for usage and will be removed in the next major release. Please refer to the docs and release notes for more info.");
  }
}

var require$1 = (
			false
				? /* @__PURE__ */ module$1.createRequire((typeof document === 'undefined' ? new (require('u' + 'rl').URL)('file:' + __filename).href : (document.currentScript && document.currentScript.src || new URL('index.cjs', document.baseURI).href)))
				: require
		);

const isWebpack5 = (compilation) => "processAssets" in compilation.hooks;
const { version } = require$1("../package.json");
const isJsFile = /\.[cm]?js(?:\?.*)?$/i;
const isCssFile = /\.css(?:\?.*)?$/i;
const pluginName = "esbuild-minify";
const granularMinifyConfigs = ["minifyIdentifiers", "minifySyntax", "minifyWhitespace"];
class ESBuildMinifyPlugin {
  constructor(options = {}) {
    var _a;
    const { implementation, ...remainingOptions } = options;
    if (implementation && typeof implementation.transform !== "function") {
      throw new TypeError(
        `ESBuildMinifyPlugin: implementation.transform must be an ESBuild transform function. Received ${typeof implementation.transform}`
      );
    }
    this.transform = (_a = implementation == null ? void 0 : implementation.transform) != null ? _a : esbuild.transform;
    this.options = remainingOptions;
    const hasGranularMinificationConfig = granularMinifyConfigs.some(
      (minifyConfig) => minifyConfig in options
    );
    if (!hasGranularMinificationConfig) {
      this.options.minify = true;
    }
  }
  apply(compiler) {
    const meta = JSON.stringify({
      name: "esbuild-loader",
      version,
      options: this.options
    });
    compiler.hooks.compilation.tap(pluginName, (compilation) => {
      compilation.hooks.chunkHash.tap(pluginName, (_, hash) => hash.update(meta));
      if (isWebpack5(compilation)) {
        compilation.hooks.processAssets.tapPromise(
          {
            name: pluginName,
            stage: compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
            additionalAssets: true
          },
          async () => await this.transformAssets(compilation)
        );
        compilation.hooks.statsPrinter.tap(pluginName, (statsPrinter) => {
          statsPrinter.hooks.print.for("asset.info.minimized").tap(
            pluginName,
            (minimized, { green, formatFlag }) => minimized ? green(formatFlag("minimized")) : void 0
          );
        });
      } else {
        compilation.hooks.optimizeChunkAssets.tapPromise(
          pluginName,
          async () => await this.transformAssets(compilation)
        );
      }
    });
  }
  async transformAssets(compilation) {
    var _a;
    const { compiler } = compilation;
    const { options: { devtool } } = compiler;
    const sources = (_a = compiler.webpack) == null ? void 0 : _a.sources;
    const SourceMapSource = sources ? sources.SourceMapSource : webpackSources.SourceMapSource;
    const RawSource = sources ? sources.RawSource : webpackSources.RawSource;
    const sourcemap = this.options.sourcemap === void 0 ? Boolean(devtool && devtool.includes("source-map")) : this.options.sourcemap;
    const {
      css: minifyCss,
      include,
      exclude,
      ...transformOptions
    } = this.options;
    const assets = compilation.getAssets().filter((asset) => !asset.info.minimized && (isJsFile.test(asset.name) || minifyCss && isCssFile.test(asset.name)) && ModuleFilenameHelpers_js.matchObject({ include, exclude }, asset.name));
    await Promise.all(assets.map(async (asset) => {
      const assetIsCss = isCssFile.test(asset.name);
      let source;
      let map = null;
      if (asset.source.sourceAndMap) {
        const sourceAndMap = asset.source.sourceAndMap();
        source = sourceAndMap.source;
        map = sourceAndMap.map;
      } else {
        source = asset.source.source();
        if (asset.source.map) {
          map = asset.source.map();
        }
      }
      const sourceAsString = source.toString();
      const result = await this.transform(sourceAsString, {
        ...transformOptions,
        loader: assetIsCss ? "css" : transformOptions.loader,
        sourcemap,
        sourcefile: asset.name
      });
      if (result.legalComments) {
        compilation.emitAsset(
          `${asset.name}.LEGAL.txt`,
          new RawSource(result.legalComments)
        );
      }
      compilation.updateAsset(
        asset.name,
        sourcemap ? new SourceMapSource(
          result.code,
          asset.name,
          result.map,
          sourceAsString,
          map,
          true
        ) : new RawSource(result.code),
        {
          ...asset.info,
          minimized: true
        }
      );
    }));
  }
}

exports.ESBuildMinifyPlugin = ESBuildMinifyPlugin;
exports.ESBuildPlugin = ESBuildPlugin;
exports["default"] = ESBuildLoader;
