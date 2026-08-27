import process from 'node:process';globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};globalThis.__timing__.logStart('Load chunks/virtual/entry');import { defineProdDiagnostics } from 'nostics';
import { ansiFormatter } from 'nostics/formatters/ansi';
import { getCurrentScope, ref, watchEffect, getCurrentInstance, onBeforeUnmount, onDeactivated, onActivated, createApp, provide, onErrorCaptured, onServerPrefetch, unref, createVNode, resolveDynamicComponent, shallowReactive, reactive, effectScope, hasInjectionContext, inject, defineAsyncComponent, mergeProps, defineComponent, toRef, computed, h, isReadonly, useSSRContext, isRef, isShallow, isReactive, toRaw } from 'vue';
import { f as createError, $ as $fetch, m as isEqual, n as stringifyParsedURL, o as stringifyQuery, p as parseQuery, q as hasProtocol, i as joinURL, v as defu, w as withQuery, x as sanitizeStatusCode, y as parseURL, e as encodePath, z as decodePath, A as isScriptProtocol } from '../_/nitro.mjs';
import { i as injectHead$1, V as VueResolver, h as headSymbol, b as baseURL } from '../routes/renderer.mjs';
import { ssrRenderSuspense, ssrRenderComponent, ssrRenderVNode, ssrRenderAttrs, ssrRenderList, ssrRenderStyle, ssrRenderClass, ssrRenderAttr, ssrInterpolate } from 'vue/server-renderer';
import { walkResolver } from 'unhead/utils';

function useHead(input, options = {}) {
  const head = options.head || injectHead$1();
  return head.ssr ? head.push(input || {}, options) : clientUseHead(head, input, options);
}
function clientUseHead(head, input, options = {}) {
  const scope = getCurrentScope();
  if (scope && !scope.active) {
    return { patch() {
    }, dispose() {
    }, _i: -1 };
  }
  const deactivated = ref(false);
  if (options.onRendered && scope) {
    const _onRendered = options.onRendered;
    options = { ...options, onRendered: (ctx) => scope.run(() => _onRendered(ctx)) };
  }
  let entry;
  watchEffect(() => {
    const i = deactivated.value ? {} : walkResolver(input, VueResolver);
    if (entry) {
      entry.patch(i);
    } else {
      entry = head.push(i, options);
    }
  });
  const vm = getCurrentInstance();
  if (vm) {
    onBeforeUnmount(() => {
      entry.dispose();
    });
    onDeactivated(() => {
      deactivated.value = true;
    });
    onActivated(() => {
      deactivated.value = false;
    });
  }
  return entry;
}

function flatHooks(configHooks, hooks = {}, parentName) {
	for (const key in configHooks) {
		const subHook = configHooks[key];
		const name = parentName ? `${parentName}:${key}` : key;
		if (typeof subHook === "object" && subHook !== null) flatHooks(subHook, hooks, name);
		else if (typeof subHook === "function") hooks[name] = subHook;
	}
	return hooks;
}
const createTask = /* @__PURE__ */ (() => {
	if (console.createTask) return console.createTask;
	const defaultTask = { run: (fn) => fn() };
	return () => defaultTask;
})();
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result && typeof result.then === "function") return Promise.resolve(result).then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
function serialTaskCaller(hooks, args, name) {
	if (hooks.length > 0) return callHooks(hooks, args, 0, createTask(name));
}
function parallelTaskCaller(hooks, args, name) {
	if (hooks.length > 0) {
		const task = createTask(name);
		return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
	}
}
function callEachWith(callbacks, arg0) {
	for (const callback of [...callbacks]) callback(arg0);
}
var Hookable = class {
	_hooks;
	_before;
	_after;
	_deprecatedHooks;
	_deprecatedMessages;
	constructor() {
		this._hooks = {};
		this._before = void 0;
		this._after = void 0;
		this._deprecatedMessages = void 0;
		this._deprecatedHooks = {};
		this.hook = this.hook.bind(this);
		this.callHook = this.callHook.bind(this);
		this.callHookWith = this.callHookWith.bind(this);
	}
	hook(name, function_, options = {}) {
		if (!name || typeof function_ !== "function") return () => {};
		const originalName = name;
		let dep;
		while (this._deprecatedHooks[name]) {
			dep = this._deprecatedHooks[name];
			name = dep.to;
		}
		if (dep && !options.allowDeprecated) {
			let message = dep.message;
			if (!message) message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
			if (!this._deprecatedMessages) this._deprecatedMessages = /* @__PURE__ */ new Set();
			if (!this._deprecatedMessages.has(message)) {
				console.warn(message);
				this._deprecatedMessages.add(message);
			}
		}
		if (!function_.name) try {
			Object.defineProperty(function_, "name", {
				get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
				configurable: true
			});
		} catch {}
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(function_);
		return () => {
			if (function_) {
				this.removeHook(name, function_);
				function_ = void 0;
			}
		};
	}
	hookOnce(name, function_) {
		let _unreg;
		let _function = (...arguments_) => {
			if (typeof _unreg === "function") _unreg();
			_unreg = void 0;
			_function = void 0;
			return function_(...arguments_);
		};
		_unreg = this.hook(name, _function);
		return _unreg;
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	clearHook(name) {
		this._hooks[name] = void 0;
	}
	deprecateHook(name, deprecated) {
		this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
		const _hooks = this._hooks[name] || [];
		this._hooks[name] = void 0;
		for (const hook of _hooks) this.hook(name, hook);
	}
	deprecateHooks(deprecatedHooks) {
		for (const name in deprecatedHooks) this.deprecateHook(name, deprecatedHooks[name]);
	}
	addHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
		return () => {
			for (const unreg of removeFns) unreg();
			removeFns.length = 0;
		};
	}
	removeHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		for (const key in hooks) this.removeHook(key, hooks[key]);
	}
	removeAllHooks() {
		this._hooks = {};
	}
	callHook(name, ...args) {
		return this.callHookWith(serialTaskCaller, name, args);
	}
	callHookParallel(name, ...args) {
		return this.callHookWith(parallelTaskCaller, name, args);
	}
	callHookWith(caller, name, args) {
		const event = this._before || this._after ? {
			name,
			args,
			context: {}
		} : void 0;
		if (this._before) callEachWith(this._before, event);
		const result = caller(this._hooks[name] ? [...this._hooks[name]] : [], args, name);
		if (result instanceof Promise) return result.finally(() => {
			if (this._after && event) callEachWith(this._after, event);
		});
		if (this._after && event) callEachWith(this._after, event);
		return result;
	}
	beforeEach(function_) {
		this._before = this._before || [];
		this._before.push(function_);
		return () => {
			if (this._before !== void 0) {
				const index = this._before.indexOf(function_);
				if (index !== -1) this._before.splice(index, 1);
			}
		};
	}
	afterEach(function_) {
		this._after = this._after || [];
		this._after.push(function_);
		return () => {
			if (this._after !== void 0) {
				const index = this._after.indexOf(function_);
				if (index !== -1) this._after.splice(index, 1);
			}
		};
	}
};
function createHooks() {
	return new Hookable();
}
const isBrowser = "undefined" !== "undefined";
function createDebugger(hooks, _options = {}) {
	const options = {
		inspect: isBrowser,
		group: isBrowser,
		filter: () => true,
		..._options
	};
	const _filter = options.filter;
	const filter = typeof _filter === "string" ? (name) => name.startsWith(_filter) : _filter;
	const _tag = options.tag ? `[${options.tag}] ` : "";
	const logPrefix = (event) => _tag + event.name + "".padEnd(event._id, "\0");
	const _idCtr = {};
	const unsubscribeBefore = hooks.beforeEach((event) => {
		if (filter !== void 0 && !filter(event.name)) return;
		_idCtr[event.name] = _idCtr[event.name] || 0;
		event._id = _idCtr[event.name]++;
		console.time(logPrefix(event));
	});
	const unsubscribeAfter = hooks.afterEach((event) => {
		if (filter !== void 0 && !filter(event.name)) return;
		if (options.group) console.groupCollapsed(event.name);
		if (options.inspect) console.timeLog(logPrefix(event), event.args);
		else console.timeEnd(logPrefix(event));
		if (options.group) console.groupEnd();
		_idCtr[event.name]--;
	});
	return { close: () => {
		unsubscribeBefore();
		unsubscribeAfter();
	} };
}

function _getAsyncLocalStorage() {
	return globalThis.AsyncLocalStorage || globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncLocalStorage;
}
const _WeakRef = globalThis.WeakRef || class StrongRef {
	#value;
	constructor(value) {
		this.#value = value;
	}
	deref() {
		return this.#value;
	}
};
function createContext(opts = {}) {
	let currentInstance;
	let isSingleton = false;
	const checkConflict = (instance) => {
		if (currentInstance && currentInstance !== instance) throw new Error("Context conflict");
	};
	let als;
	if (opts.asyncContext) {
		const _AsyncLocalStorage = opts.AsyncLocalStorage || _getAsyncLocalStorage();
		if (_AsyncLocalStorage) als = new _AsyncLocalStorage();
		else console.warn("[unctx] `AsyncLocalStorage` is not provided.");
	}
	const _wrapInstance = (instance) => als && instance !== null && typeof instance === "object" ? { __unctx_weak: new _WeakRef(instance) } : instance;
	const _unwrapInstance = (store) => store && store.__unctx_weak ? store.__unctx_weak.deref() : store;
	const _getCurrentInstance = () => {
		if (als) {
			const store = als.getStore();
			if (store !== void 0) return _unwrapInstance(store);
		}
		return currentInstance;
	};
	return {
		use: () => {
			const _instance = _getCurrentInstance();
			if (_instance === void 0) throw new Error("Context is not available");
			return _instance;
		},
		tryUse: () => {
			return _getCurrentInstance() ?? null;
		},
		set: (instance, replace) => {
			if (!replace) checkConflict(instance);
			currentInstance = instance;
			isSingleton = true;
		},
		unset: () => {
			currentInstance = void 0;
			isSingleton = false;
		},
		call: (instance, callback) => {
			checkConflict(instance);
			currentInstance = instance;
			try {
				return als ? als.run(_wrapInstance(instance), callback) : callback();
			} finally {
				if (!isSingleton) currentInstance = void 0;
			}
		},
		async callAsync(instance, callback) {
			currentInstance = instance;
			const onRestore = () => {
				currentInstance = instance;
			};
			const onLeave = () => currentInstance === instance ? onRestore : void 0;
			asyncHandlers.add(onLeave);
			try {
				const r = als ? als.run(_wrapInstance(instance), callback) : callback();
				if (!isSingleton) currentInstance = void 0;
				return await r;
			} finally {
				asyncHandlers.delete(onLeave);
			}
		}
	};
}
function createNamespace(defaultOpts = {}) {
	const contexts = {};
	return { get(key, opts = {}) {
		if (!contexts[key]) contexts[key] = createContext({
			...defaultOpts,
			...opts
		});
		return contexts[key];
	} };
}
const _globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
const globalKey = "__unctx__";
const defaultNamespace = _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());
const getContext = (key, opts = {}) => defaultNamespace.get(key, opts);
const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers = _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = /* @__PURE__ */ new Set());

//#region node_modules/nuxt/dist/app/diagnostics/_shared.js
/**
* Shared configuration for the runtime (E<N>xxx) diagnostics catalogs.
*
* Catalogs are split by domain and imported directly where used (no barrel),
* so the browser bundle only pulls in the codes a module references. Pair the
* pure-call annotations on each `defineDiagnostics()` with dev-guarded,
* statement-level report calls so report-only diagnostics strip from production.
*
* Codes are stable, fully-qualified `NUXT_E<NNNN>` identifiers. Codes with a
* dedicated docs page resolve a `see:` URL via {@link docsBase}; the rest opt
* out with `docs: false`.
*/
function docsBase(code) {
	return `https://nuxt.com/docs/4.x/errors/${code.replace("NUXT_", "").toLowerCase()}`;
}
var ansi = (open, close) => (s) => `\x1B[${open}m${s}\x1B[${close}m`;
var colors = {
	red: ansi(31, 39),
	yellow: ansi(33, 39),
	cyan: ansi(36, 39),
	gray: ansi(90, 39),
	bold: ansi(1, 22),
	dim: ansi(2, 22)
};
ansiFormatter(colors);
var prodReporter = (diagnostic) => {
	console.error(`[${diagnostic.name}]`);
};
var prodReporters = [prodReporter];
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/core.js
/**
* E1xxx
* Core / Nuxt-instance / lifecycle runtime diagnostics.
*/
var appDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fnuxt.config.mjs
var nuxtLinkDefaults = {
	"componentName": "NuxtLink"};
//#endregion
//#region node_modules/nuxt/dist/app/nuxt.js
function getNuxtAppCtx(id = "nuxt-app") {
	return getContext(id, { asyncContext: false });
}
var NuxtPluginIndicator = "__nuxt_plugin";
/** @since 3.0.0 */
function createNuxtApp(options) {
	let hydratingCount = 0;
	const nuxtApp = {
		_id: options.id || "nuxt-app",
		_scope: effectScope(),
		provide: void 0,
		versions: {
			get nuxt() {
				return "4.5.2";
			},
			get vue() {
				return nuxtApp.vueApp.version;
			}
		},
		payload: shallowReactive({
			...options.ssrContext?.payload || {},
			data: shallowReactive({}),
			state: reactive({}),
			once: /* @__PURE__ */ new Set(),
			_errors: shallowReactive({})
		}),
		static: { data: {} },
		runWithContext(fn) {
			if (nuxtApp._scope.active && !getCurrentScope()) return nuxtApp._scope.run(() => callWithNuxt(nuxtApp, fn));
			return callWithNuxt(nuxtApp, fn);
		},
		isHydrating: false,
		deferHydration() {
			if (!nuxtApp.isHydrating) return () => {};
			hydratingCount++;
			let called = false;
			return () => {
				if (called) return;
				called = true;
				hydratingCount--;
				if (hydratingCount === 0) {
					nuxtApp.isHydrating = false;
					return nuxtApp.callHook("app:suspense:resolve");
				}
			};
		},
		_asyncDataPromises: {},
		_asyncData: shallowReactive({}),
		_state: shallowReactive({}),
		_payloadRevivers: {},
		...options
	};
	nuxtApp.payload.serverRendered = true;
	if (nuxtApp.ssrContext) {
		nuxtApp.payload.path = nuxtApp.ssrContext.url;
		nuxtApp.ssrContext.nuxt = nuxtApp;
		nuxtApp.ssrContext.payload = nuxtApp.payload;
		nuxtApp.ssrContext.config = {
			public: nuxtApp.ssrContext.runtimeConfig.public,
			app: nuxtApp.ssrContext.runtimeConfig.app
		};
	}
	nuxtApp.hooks = createHooks();
	nuxtApp.hook = nuxtApp.hooks.hook;
	{
		const contextCaller = async function(hooks, args) {
			for (const hook of hooks) await nuxtApp.runWithContext(() => hook(...args));
		};
		nuxtApp.hooks.callHook = (name, ...args) => nuxtApp.hooks.callHookWith(contextCaller, name, args);
	}
	nuxtApp.callHook = nuxtApp.hooks.callHook;
	nuxtApp.provide = (name, value) => {
		const $name = "$" + name;
		defineGetter(nuxtApp, $name, value);
		defineGetter(nuxtApp.vueApp.config.globalProperties, $name, value);
	};
	defineGetter(nuxtApp.vueApp, "$nuxt", nuxtApp);
	defineGetter(nuxtApp.vueApp.config.globalProperties, "$nuxt", nuxtApp);
	const runtimeConfig = options.ssrContext.runtimeConfig;
	nuxtApp.provide("config", runtimeConfig);
	return nuxtApp;
}
/** @since 3.0.0 */
async function applyPlugin(nuxtApp, plugin) {
	if (typeof plugin === "function") {
		const run = () => nuxtApp.runWithContext(() => plugin(nuxtApp));
		const { provide } = await run() || {};
		if (provide && typeof provide === "object") for (const key in provide) nuxtApp.provide(key, provide[key]);
	}
}
/** @since 3.0.0 */
async function applyPlugins(nuxtApp, plugins) {
	let error;
	for (const plugin of plugins) try {
		await applyPlugin(nuxtApp, plugin);
	} catch (e) {
		if (!nuxtApp.payload.error) throw e;
		error ||= e;
	}
	if (error) throw nuxtApp.payload.error || error;
}
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtPlugin(plugin) {
	if (typeof plugin === "function") return plugin;
	const _name = plugin._name || plugin.name;
	delete plugin.name;
	return Object.assign(plugin.setup || (() => {}), plugin, {
		[NuxtPluginIndicator]: true,
		_name
	});
}
/**
* Ensures that the setup function passed in has access to the Nuxt instance via `useNuxtApp`.
* @param nuxt A Nuxt instance
* @param setup The function to call
* @since 3.0.0
*/
function callWithNuxt(nuxt, setup, args) {
	const fn = () => setup();
	const nuxtAppCtx = getNuxtAppCtx(nuxt._id);
	return nuxt.vueApp.runWithContext(() => nuxtAppCtx.callAsync(nuxt, fn));
}
function tryUseNuxtApp(id) {
	let nuxtAppInstance;
	if (hasInjectionContext()) nuxtAppInstance = getCurrentInstance()?.appContext.app.$nuxt;
	nuxtAppInstance ||= getNuxtAppCtx(id).tryUse();
	return nuxtAppInstance || null;
}
function useNuxtApp(id) {
	const nuxtAppInstance = tryUseNuxtApp(id);
	if (!nuxtAppInstance) throw appDiagnostics.NUXT_E1001();
	return nuxtAppInstance;
}
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function useRuntimeConfig(_event) {
	return useNuxtApp().$config;
}
function defineGetter(obj, key, val) {
	Object.defineProperty(obj, key, { get: () => val });
}
//#endregion
//#region node_modules/nuxt/dist/app/utils.js
globalThis._importMeta_.url.replace(/\/app\/.*$/, "/");
//#endregion
//#region node_modules/nuxt/dist/app/components/injections.js
var PageRouteSymbol = Symbol("route");
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/navigation.js
/**
* E2xxx
* Navigation / routing / middleware runtime diagnostics.
*/
var navigationDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/app/composables/router.js
/** @since 3.0.0 */
var useRouter = () => {
	return useNuxtApp()?.$router;
};
/**
* Whether the current effect scope is (a descendant of) the component instance's scope.
* A detached scope (e.g. `createSharedComposable`) outlives the component, so the
* per-page route injected there would freeze after navigation (#18903).
*/
function isScopeWithinInstance(instance) {
	const instanceScope = instance.scope;
	let scope = getCurrentScope();
	while (scope) {
		if (scope === instanceScope) return true;
		scope = scope.parent;
	}
	return false;
}
/** @since 3.0.0 */
var useRoute = (() => {
	if (hasInjectionContext()) {
		const instance = getCurrentInstance();
		if (!instance || isScopeWithinInstance(instance)) return inject(PageRouteSymbol, useNuxtApp()._route);
	}
	return useNuxtApp()._route;
});
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtRouteMiddleware(middleware) {
	return middleware;
}
/** @since 3.0.0 */
var isProcessingMiddleware = () => {
	try {
		if (useNuxtApp()._processingMiddleware) return true;
	} catch {
		return false;
	}
	return false;
};
var HTML_ATTR_UNSAFE_RE = /[&"'<>]/g;
var HTML_ATTR_ENCODE_MAP = {
	"&": "&amp;",
	"\"": "&quot;",
	"'": "&#x27;",
	"<": "&lt;",
	">": "&gt;"
};
function encodeForHtmlAttr(value) {
	return value.replace(HTML_ATTR_UNSAFE_RE, (c) => HTML_ATTR_ENCODE_MAP[c]);
}
/**
* A helper that aids in programmatic navigation within your Nuxt application.
*
* Can be called on the server and on the client, within pages, route middleware, plugins, and more.
* @param {RouteLocationRaw | undefined | null} [to] - The route to navigate to. Accepts a route object, string path, `undefined`, or `null`. Defaults to '/'.
* @param {NavigateToOptions} [options] - Optional customization for controlling the behavior of the navigation.
* @returns {Promise<void | NavigationFailure | false> | false | void | RouteLocationRaw} The navigation result, which varies depending on context and options.
* @see https://nuxt.com/docs/4.x/api/utils/navigate-to
* @since 3.0.0
*/
var navigateTo = (to, options) => {
	to ||= "/";
	const toPath = typeof to === "string" ? to : "path" in to ? resolveRouteObject(to) : useRouter().resolve(to).href;
	const isExternalHost = hasProtocol(toPath, { acceptRelative: true });
	const isExternal = options?.external || isExternalHost;
	if (isExternal) {
		if (!options?.external) throw navigationDiagnostics.NUXT_E2001({ toPath });
		const { protocol } = new URL(toPath, "http://localhost");
		if (protocol && isScriptProtocol(protocol)) throw navigationDiagnostics.NUXT_E2002({
			toPath,
			protocol
		});
	}
	const inMiddleware = isProcessingMiddleware();
	const router = useRouter();
	const nuxtApp = useNuxtApp();
	if (nuxtApp.ssrContext) {
		const fullPath = typeof to === "string" || isExternal ? toPath : router.resolve(to).fullPath || "/";
		const location = isExternal ? toPath : joinURL((/* @__PURE__ */ useRuntimeConfig()).app.baseURL, fullPath);
		const redirect = async function(response) {
			await nuxtApp.callHook("app:redirected");
			const encodedHeader = encodeURL(location, isExternalHost);
			const encodedLoc = encodeForHtmlAttr(encodedHeader);
			nuxtApp.ssrContext["~renderResponse"] = {
				statusCode: sanitizeStatusCode(options?.redirectCode || 302, 302),
				body: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`,
				headers: { location: encodedHeader }
			};
			return response;
		};
		if (!isExternal && inMiddleware) {
			router.afterEach((final) => final.fullPath === fullPath ? redirect(false) : void 0);
			return to;
		}
		return redirect(!inMiddleware ? void 0 : false);
	}
	if (isExternal) {
		nuxtApp._scope.stop();
		if (options?.replace) (void 0).replace(toPath);
		else (void 0).href = toPath;
		if (inMiddleware) {
			if (!nuxtApp.isHydrating) return false;
			return new Promise(() => {});
		}
		return Promise.resolve();
	}
	const encodedTo = typeof to === "string" ? encodeRoutePath(to) : to;
	return options?.replace ? router.replace(encodedTo) : router.push(encodedTo);
};
/**
* @internal
*/
function resolveRouteObject(to) {
	return withQuery(to.path || "", to.query || {}) + (to.hash || "");
}
/**
* @internal
*/
function encodeURL(location, isExternalHost = false) {
	const url = new URL(location, "http://localhost");
	if (!isExternalHost) return url.pathname.replace(/^\/{2,}/, "/") + url.search + url.hash;
	if (location.startsWith("//")) return url.toString().replace(url.protocol, "");
	return url.toString();
}
/**
* Encode the pathname of a route location string. Ensures decoded paths like
* `/café` are percent-encoded to match vue-router's encoded route records.
* Already-encoded paths are not double-encoded.
* @internal
*/
function encodeRoutePath(url) {
	const parsed = parseURL(url);
	return encodePath(decodePath(parsed.pathname)) + parsed.search + parsed.hash;
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/error.js
var NUXT_ERROR_SIGNATURE = "__nuxt_error";
/** @since 3.0.0 */
var useError = /* @__NO_SIDE_EFFECTS__ */ () => toRef(useNuxtApp().payload, "error");
/** @since 3.0.0 */
var showError = (error) => {
	const nuxtError = createError$1(error);
	try {
		const error = /* @__PURE__ */ useError();
		error.value ||= nuxtError;
	} catch {
		throw nuxtError;
	}
	return nuxtError;
};
/** @since 3.0.0 */
var isNuxtError = (error) => !!error && typeof error === "object" && "__nuxt_error" in error;
/** @since 3.0.0 */
var createError$1 = (error) => {
	if (typeof error !== "string" && error.statusText) error.message ??= error.statusText;
	const nuxtError = createError(error);
	Object.defineProperty(nuxtError, NUXT_ERROR_SIGNATURE, {
		value: true,
		configurable: false,
		writable: false
	});
	Object.defineProperty(nuxtError, "status", {
		get: () => nuxtError.statusCode,
		configurable: true
	});
	Object.defineProperty(nuxtError, "statusText", {
		get: () => nuxtError.statusMessage,
		configurable: true
	});
	return nuxtError;
};
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Ffetch.mjs
if (!globalThis.$fetch) globalThis.$fetch = $fetch.create({ baseURL: baseURL() });
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fglobal-polyfills.mjs
if (!("global" in globalThis)) globalThis.global = globalThis;
//#endregion
//#region node_modules/nuxt/dist/head/runtime/island-head.js
/**
* No-op `head.push` until the returned `unfreeze` runs. Plugin/transformer
* augmentations on the same head are unaffected.
*/
function freezeHead(head) {
	const realPush = head.push;
	head.push = () => ({
		dispose: () => {},
		patch: () => {},
		_i: 0
	});
	return () => {
		head.push = realPush;
	};
}
//#endregion
//#region node_modules/nuxt/dist/head/runtime/plugins/unhead.server.js
var plugin$3 = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:head",
	enforce: "pre",
	setup(nuxtApp) {
		const head = nuxtApp.ssrContext.head;
		if (nuxtApp.ssrContext.islandContext) {
			const unfreeze = freezeHead(head);
			nuxtApp.hooks.hookOnce("app:created", unfreeze);
		}
		nuxtApp.vueApp.use(head);
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/manifest.js
/**
* E5xxx
* App manifest / route-rules runtime diagnostics.
*/
var manifestDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Frouter.options.mjs
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default = {};
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Froute-rules.mjs
var sensitiveMatcher = (m, p) => {
	return [];
};
var foldedMatcher = sensitiveMatcher;
var decodeRoutePath = function decodeRoutePath(path) {
	if (!path.includes("%")) return path;
	const queryIndex = path.indexOf("?");
	const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
	try {
		return queryIndex === -1 ? decodeURI(pathname) : decodeURI(pathname) + path.slice(queryIndex);
	} catch {
		return path;
	}
};
var normalizePath = (path, fold) => {
	if (typeof path !== "string") return path;
	const decoded = decodeRoutePath(path);
	return fold ? decoded.toLowerCase() : decoded;
};
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froute_rules_default = (path) => virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.sensitive ? defu({}, ...sensitiveMatcher("", normalizePath(path, false)).map((r) => r.data).reverse()) : defu({}, ...foldedMatcher("", normalizePath(path, true)).map((r) => r.data).reverse());
//#endregion
//#region node_modules/nuxt/dist/app/composables/manifest.js
var routeRulesMatcher = virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froute_rules_default;
function getRouteRules(arg) {
	const path = typeof arg === "string" ? arg : arg.path;
	try {
		return routeRulesMatcher(path);
	} catch (e) {
		manifestDiagnostics.NUXT_E5003({
			path,
			cause: e
		});
		return {};
	}
}
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fmiddleware.mjs
var globalMiddleware = [/* @__PURE__ */ defineNuxtRouteMiddleware((to) => {})];
//#endregion
//#region node_modules/nuxt/dist/app/plugins/router.js
function getRouteFromPath(fullPath) {
	const route = fullPath && typeof fullPath === "object" ? fullPath : {};
	if (typeof fullPath === "object") fullPath = stringifyParsedURL({
		pathname: fullPath.path || "",
		search: stringifyQuery(fullPath.query || {}),
		hash: fullPath.hash || ""
	});
	const url = new URL(fullPath.toString(), "http://localhost");
	return {
		path: url.pathname,
		fullPath,
		query: parseQuery(url.search),
		hash: url.hash,
		params: route.params || {},
		name: void 0,
		matched: route.matched || [],
		redirectedFrom: void 0,
		meta: route.meta || {},
		href: fullPath
	};
}
var plugin$2 = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:router",
	enforce: "pre",
	setup(nuxtApp) {
		const initialURL = nuxtApp.ssrContext.url;
		const routes = [];
		const hooks = {
			"navigate:before": [],
			"resolve:before": [],
			"navigate:after": [],
			"error": []
		};
		const registerHook = (hook, guard) => {
			hooks[hook].push(guard);
			return () => {
				const index = hooks[hook].indexOf(guard);
				if (index !== -1) hooks[hook].splice(index, 1);
			};
		};
		(/* @__PURE__ */ useRuntimeConfig()).app.baseURL;
		const route = reactive(getRouteFromPath(initialURL));
		let navigationCounter = 0;
		async function handleNavigation(url, replace) {
			const navigationId = ++navigationCounter;
			try {
				const to = getRouteFromPath(url);
				for (const middleware of hooks["navigate:before"]) {
					const result = await middleware(to, route);
					if (navigationId !== navigationCounter) return;
					if (result === false || result instanceof Error) return;
					if (typeof result === "string" && result.length) return await handleNavigation(result, true);
				}
				for (const handler of hooks["resolve:before"]) {
					await handler(to, route);
					if (navigationId !== navigationCounter) return;
				}
				Object.assign(route, to);
				for (const middleware of hooks["navigate:after"]) await middleware(to, route);
			} catch (err) {
				for (const handler of hooks.error) await handler(err);
			}
		}
		const router = {
			currentRoute: computed(() => route),
			isReady: () => Promise.resolve(),
			options: {},
			install: () => Promise.resolve(),
			push: (url) => handleNavigation(url),
			replace: (url) => handleNavigation(url),
			back: () => (void 0).history.go(-1),
			go: (delta) => (void 0).history.go(delta),
			forward: () => (void 0).history.go(1),
			beforeResolve: (guard) => registerHook("resolve:before", guard),
			beforeEach: (guard) => registerHook("navigate:before", guard),
			afterEach: (guard) => registerHook("navigate:after", guard),
			onError: (handler) => registerHook("error", handler),
			resolve: getRouteFromPath,
			addRoute: (parentName, route) => {
				routes.push(route);
			},
			getRoutes: () => routes,
			hasRoute: (name) => routes.some((route) => route.name === name),
			removeRoute: (name) => {
				const index = routes.findIndex((route) => route.name === name);
				if (index !== -1) routes.splice(index, 1);
			}
		};
		nuxtApp.vueApp.component("RouterLink", defineComponent({
			functional: true,
			props: {
				to: {
					type: String,
					required: true
				},
				custom: Boolean,
				replace: Boolean,
				activeClass: String,
				exactActiveClass: String,
				ariaCurrentValue: String
			},
			setup: (props, { slots }) => {
				const navigate = () => handleNavigation(props.to, props.replace);
				return () => {
					const route = router.resolve(props.to);
					return props.custom ? slots.default?.({
						href: props.to,
						navigate,
						route
					}) : h("a", {
						href: props.to,
						onClick: (e) => {
							e.preventDefault();
							return navigate();
						}
					}, slots);
				};
			}
		}));
		nuxtApp._route = route;
		nuxtApp._middleware ||= {
			global: [],
			named: {}
		};
		const initialLayout = nuxtApp.payload.state._layout;
		const initialLayoutProps = nuxtApp.payload.state._layoutProps;
		nuxtApp.hooks.hookOnce("app:created", async () => {
			router.beforeEach(async (to, from) => {
				to.meta = reactive(to.meta || {});
				if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) {
					to.meta.layout = initialLayout;
					to.meta.layoutProps = initialLayoutProps;
				}
				nuxtApp._processingMiddleware = true;
				nuxtApp._middlewareTo = to;
				if (!nuxtApp.ssrContext?.islandContext) {
					const middlewareEntries = /* @__PURE__ */ new Set([...globalMiddleware, ...nuxtApp._middleware.global]);
					const routeRules = getRouteRules({ path: to.path });
					if (routeRules.appMiddleware) for (const key in routeRules.appMiddleware) {
						const guard = nuxtApp._middleware.named[key];
						if (!guard) continue;
						if (routeRules.appMiddleware[key]) middlewareEntries.add(guard);
						else middlewareEntries.delete(guard);
					}
					for (const middleware of middlewareEntries) {
						const result = await nuxtApp.runWithContext(() => middleware(to, from));
						if (result === false || result instanceof Error) {
							const error = result || createError({
								status: 404,
								statusText: `Page Not Found: ${initialURL}`,
								data: { path: initialURL }
							});
							delete nuxtApp._processingMiddleware;
							delete nuxtApp._middlewareTo;
							return nuxtApp.runWithContext(() => showError(error));
						}
						if (result === true) continue;
						if (result || result === false) return result;
					}
				}
			});
			router.afterEach(() => {
				delete nuxtApp._processingMiddleware;
				delete nuxtApp._middlewareTo;
			});
			await router.replace(initialURL);
			if (!isEqual(route.fullPath, initialURL)) await nuxtApp.runWithContext(() => navigateTo(route.fullPath));
		});
		return { provide: {
			route,
			router
		} };
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/plugins/debug-hooks.js
var plugin$1 = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:debug:hooks",
	enforce: "pre",
	setup(nuxtApp) {
		createDebugger(nuxtApp.hooks, { tag: "nuxt-app" });
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/head.js
/**
* E6xxx
* Head / unhead runtime diagnostics.
*/
var unheadDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/head/runtime/composables.js
/**
* Injects the head client from the Nuxt context or Vue inject.
*/
function injectHead(nuxtApp) {
	const nuxt = nuxtApp || useNuxtApp();
	return nuxt.ssrContext?.head || nuxt.runWithContext(() => {
		if (hasInjectionContext()) {
			const head = inject(headSymbol);
			if (!head) throw unheadDiagnostics.NUXT_E6001();
			return head;
		}
	});
}
function useHead$1(input, options = {}) {
	const head = options.head || injectHead(options.nuxt);
	return useHead(input, {
		head,
		...options
	});
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/payload.js
/**
* This is an experimental function for configuring passing rich data from server -> client.
* @since 3.4.0
*/
function definePayloadReducer(name, reduce) {
	useNuxtApp().ssrContext["~payloadReducers"][name] = reduce;
}
//#endregion
//#region node_modules/nuxt/dist/app/plugins/revive-payload.server.js
var reducers = [
	["NuxtError", (data) => isNuxtError(data) && data.toJSON()],
	["EmptyShallowRef", (data) => isRef(data) && isShallow(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
	["EmptyRef", (data) => isRef(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
	["ShallowRef", (data) => isRef(data) && isShallow(data) && data.value],
	["ShallowReactive", (data) => isReactive(data) && isShallow(data) && toRaw(data)],
	["Ref", (data) => isRef(data) && data.value],
	["Reactive", (data) => isReactive(data) && toRaw(data)]
];
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fplugins.server.mjs
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fplugins_server_default = [
	plugin$3,
	plugin$2,
	plugin$1,
	/* @__PURE__ */ defineNuxtPlugin({
		name: "nuxt:revive-payload:server",
		setup() {
			for (const [reducer, fn] of reducers) definePayloadReducer(reducer, fn);
		}
	}),
	/* @__PURE__ */ defineNuxtPlugin({ name: "nuxt:global-components" })
];
//#endregion
//#region assets/images/home/1_thumbnail_baby.png?url
var _1_thumbnail_baby_default = "" + __buildAssetsURL("1_thumbnail_baby.DdqAObs2.png");
//#endregion
//#region assets/images/home/2_thumbnail_athlete_podium.png?url
var _2_thumbnail_athlete_podium_default = "" + __buildAssetsURL("2_thumbnail_athlete_podium.2BljEzFf.png");
//#endregion
//#region assets/images/home/2_thumbnail_athlete_training.png?url
var _2_thumbnail_athlete_training_default = "" + __buildAssetsURL("2_thumbnail_athlete_training.BzdmcRtW.png");
//#endregion
//#region assets/images/home/3_thumbnail_college.png?url
var _3_thumbnail_college_default = "" + __buildAssetsURL("3_thumbnail_college.BPS8zoB8.png");
//#endregion
//#region assets/images/home/3_thumbnail_college_graduate.png?url
var _3_thumbnail_college_graduate_default = "" + __buildAssetsURL("3_thumbnail_college_graduate.CXRP-ZJv.png");
//#endregion
//#region assets/images/home/4_thumbnail_work.png?url
var _4_thumbnail_work_default = "" + __buildAssetsURL("4_thumbnail_work.DNpvCATb.png");
//#endregion
//#region assets/images/home/4_thumbnail_workmates.png?url
var _4_thumbnail_workmates_default = "" + __buildAssetsURL("4_thumbnail_workmates.DHQkUie_.png");
//#endregion
//#region assets/episode_thumbnails/episode_one/badminton.mp4?url
var badminton_default = "" + __buildAssetsURL("badminton.Ca11r6KD.mp4");
//#endregion
//#region assets/episode_thumbnails/episode_one/programming.mp4?url
var programming_default = "" + __buildAssetsURL("programming.CaDBM7O7.mp4");
//#endregion
//#region assets/favicon/kp_favicon.ico
var kp_favicon_default = "" + __buildAssetsURL("kp_favicon.B8zIlRr6.ico");
//#endregion
//#region app.vue?vue&type=script&setup=true&lang.ts
var app_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "app",
	__ssrInlineRender: true,
	setup(__props) {
		useHead$1({ link: [{
			rel: "icon",
			type: "image/x-icon",
			href: kp_favicon_default
		}] });
		const homeImageGroups = Object.entries(/* @__PURE__ */ Object.assign({
			"./assets/images/home/1_thumbnail_baby.png": _1_thumbnail_baby_default,
			"./assets/images/home/2_thumbnail_athlete_podium.png": _2_thumbnail_athlete_podium_default,
			"./assets/images/home/2_thumbnail_athlete_training.png": _2_thumbnail_athlete_training_default,
			"./assets/images/home/3_thumbnail_college.png": _3_thumbnail_college_default,
			"./assets/images/home/3_thumbnail_college_graduate.png": _3_thumbnail_college_graduate_default,
			"./assets/images/home/4_thumbnail_work.png": _4_thumbnail_work_default,
			"./assets/images/home/4_thumbnail_workmates.png": _4_thumbnail_workmates_default
		})).map(([path, url]) => ({
			order: Number(path.match(/\/(\d+)_/)?.[1]),
			path,
			url
		})).filter(({ order }) => Number.isFinite(order)).sort((first, second) => first.order - second.order || first.path.localeCompare(second.path)).reduce((groups, image) => {
			const currentGroup = groups.at(-1);
			if (!currentGroup || currentGroup.order !== image.order) groups.push({
				order: image.order,
				images: [image.url]
			});
			else currentGroup.images.push(image.url);
			return groups;
		}, []);
		const episodeThumbnailModules = /* #__PURE__ */ Object.assign({
			"./assets/episode_thumbnails/episode_one/badminton.mp4": badminton_default,
			"./assets/episode_thumbnails/episode_one/programming.mp4": programming_default
		});
		const episodeFolderNames = [
			"one",
			"two",
			"three",
			"four",
			"five"
		];
		const episodeClipSequences = episodeFolderNames.map((folder) => Object.entries(episodeThumbnailModules).filter(([path]) => path.includes(`/episode_${folder}/`)).sort(([firstPath], [secondPath]) => firstPath.localeCompare(secondPath)).map(([, url]) => url));
		const isLibraryOpen = ref(false);
		const activeEpisode = ref(0);
		const activeHomeImageGroup = ref(0);
		const isTransitioning = ref(false);
		const transitionPhase = ref("idle");
		const introComplete = ref(false);
		const portalStyle = ref({});
		const cursorStyle = ref({});
		const cursorIsInteractive = ref(false);
		const cursorIsMoving = ref(false);
		const cursorIsVisible = ref(false);
		ref({
			x: 0,
			y: 0
		});
		const trailPoints = ref(Array.from({ length: 6 }, () => ({
			x: 0,
			y: 0
		})));
		const episodePreviewIndexes = ref(episodeFolderNames.map(() => 0));
		const episodePreviewFading = ref(episodeFolderNames.map(() => false));
		ref(null);
		const episodes = [
			{
				number: "01",
				title: "About Me",
				label: "Who am I & hobbies",
				className: "about",
				clips: episodeClipSequences[0]
			},
			{
				number: "02",
				title: "Education",
				label: "The learning arc",
				className: "education",
				clips: episodeClipSequences[1]
			},
			{
				number: "03",
				title: "Skills",
				label: "Tech & soft skills",
				className: "skills",
				clips: episodeClipSequences[2]
			},
			{
				number: "04",
				title: "Work Experience",
				label: "Career highlights",
				className: "work",
				clips: episodeClipSequences[3]
			},
			{
				number: "05",
				title: "Contact",
				label: "Details & resume",
				className: "contact",
				clips: episodeClipSequences[4]
			}
		];
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<main${ssrRenderAttrs(mergeProps({ class: "site-shell" }, _attrs))}>`);
			if (unref(introComplete) && unref(cursorIsVisible)) {
				_push(`<!--[-->`);
				if (!unref(cursorIsInteractive)) {
					_push(`<!--[-->`);
					ssrRenderList(unref(trailPoints), (point, index) => {
						_push(`<span class="cursor-tail" style="${ssrRenderStyle({
							left: `${point.x}px`,
							top: `${point.y}px`,
							width: `${8 - index}px`,
							height: `${8 - index}px`,
							opacity: `${.5 - index * .06}`
						})}" aria-hidden="true"></span>`);
					});
					_push(`<!--]-->`);
				} else _push(`<!---->`);
				_push(`<div class="${ssrRenderClass(["cursor", {
					"cursor--interactive": unref(cursorIsInteractive),
					"cursor--moving": unref(cursorIsMoving)
				}])}" style="${ssrRenderStyle(unref(cursorStyle))}" aria-hidden="true"></div><!--]-->`);
			} else _push(`<!---->`);
			if (!unref(introComplete)) _push(`<section class="intro" aria-label="Kurt Paguio"><p class="intro-kurt">KURT</p><p class="intro-paguio">PAGUIO</p></section>`);
			else _push(`<!---->`);
			if (unref(isTransitioning)) _push(`<div class="portal" style="${ssrRenderStyle(unref(portalStyle))}" aria-hidden="true"><span></span><span></span></div>`);
			else _push(`<!---->`);
			if (!unref(isLibraryOpen)) {
				_push(`<section class="${ssrRenderClass(["hero", { "hero--leaving": unref(transitionPhase) === "leaving" }])}" aria-labelledby="hero-title"><nav class="nav"><button class="brand" aria-label="Kurt Paguio home">KURT<span>PAGUIO</span></button><button class="menu-button" aria-label="Open episode selector"><i></i><i></i></button></nav><div class="hero-content"><p class="eyebrow">GET TO KNOW AN AMAZING SOFTWARE ENGINEER</p><h1 id="hero-title">HI!<br><em>I AM KURT.</em></h1><div class="hero-meta"><span>2026</span><span>PORTFOLIO</span><span class="rating">5 EPS</span></div><p class="hero-copy">Story of a boy who dreams to be in the world of tech and currently exploring. Get to know him one episode at a time.</p><button class="play-button"><b>▶</b> Play Now</button></div>`);
				if (unref(homeImageGroups).length) {
					_push(`<div class="home-image-showcase" aria-label="Kurt Paguio through the years"><!--[-->`);
					ssrRenderList(unref(homeImageGroups), (group, index) => {
						_push(`<div class="${ssrRenderClass([
							"home-image-group",
							`home-image-group--${group.order}`,
							{ "home-image-group--active": unref(activeHomeImageGroup) === index }
						])}"><!--[-->`);
						ssrRenderList(group.images, (image) => {
							_push(`<img${ssrRenderAttr("src", image)} alt="">`);
						});
						_push(`<!--]--></div>`);
					});
					_push(`<!--]--></div>`);
				} else _push(`<!---->`);
				_push(`<div class="droplet-field" aria-hidden="true"><!--[-->`);
				ssrRenderList(8, (n) => {
					_push(`<span></span>`);
				});
				_push(`<!--]--></div></section>`);
			} else _push(`<!---->`);
			if (unref(isLibraryOpen)) {
				_push(`<section class="${ssrRenderClass(["library", {
					"library--leaving": unref(transitionPhase) === "leaving",
					"library--entering": unref(transitionPhase) === "entering"
				}])}" aria-labelledby="library-title"><nav class="nav"><button class="brand" aria-label="Back to home">KURT<span>PAGUIO</span></button><button class="back-button">← Back</button></nav><div class="library-heading"><p class="eyebrow">NOW STREAMING</p><h2 id="library-title">The Engineer<br><em>Behind the Screen.</em></h2><p>Choose an episode to start the get-to-know me.</p></div><div class="episode-rail" role="list" aria-label="Portfolio episodes"><!--[-->`);
				ssrRenderList(episodes, (episode, index) => {
					_push(`<button class="${ssrRenderClass([
						"episode-card",
						`episode-card--${episode.className}`,
						{ "episode-card--active": unref(activeEpisode) === index }
					])}" role="listitem"${ssrRenderAttr("aria-pressed", unref(activeEpisode) === index)}>`);
					if (episode.clips.length) _push(`<video class="${ssrRenderClass(["episode-preview", { "episode-preview--fading": unref(episodePreviewFading)[index] }])}"${ssrRenderAttr("src", episode.clips[unref(episodePreviewIndexes)[index]])} muted playsinline preload="metadata" aria-hidden="true"></video>`);
					else _push(`<!---->`);
					_push(`<span class="episode-index">EP. ${ssrInterpolate(episode.number)}</span><span class="episode-title">${ssrInterpolate(episode.title)}</span><span class="episode-subtitle">${ssrInterpolate(episode.label)}</span><span class="watch-icon">↗</span></button>`);
				});
				_push(`<!--]--></div><div class="episode-detail"><span class="detail-pulse"></span><p>SELECTED EPISODE</p><strong>EP. ${ssrInterpolate(episodes[unref(activeEpisode)].number)} — ${ssrInterpolate(episodes[unref(activeEpisode)].title)}</strong><span>Content placeholder · Coming soon</span></div></section>`);
			} else _push(`<!---->`);
			_push(`</main>`);
		};
	}
});
//#endregion
//#region app.vue
var _sfc_setup$2 = app_vue_vue_type_script_setup_true_lang_default.setup;
app_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("app.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var app_default = app_vue_vue_type_script_setup_true_lang_default;
//#endregion
//#region node_modules/nuxt/dist/app/components/nuxt-error-page.vue
var _sfc_main$1 = {
	__name: "nuxt-error-page",
	__ssrInlineRender: true,
	props: { error: Object },
	setup(__props) {
		const _error = __props.error;
		const status = Number(_error.statusCode || 500);
		const is404 = status === 404;
		const statusText = _error.statusMessage ?? (is404 ? "Page Not Found" : "Internal Server Error");
		const description = _error.message || _error.toString();
		const stack = void 0;
		const _Error404 = defineAsyncComponent(() => import('../build/error-404-BLQW8do9.mjs'));
		const _Error = defineAsyncComponent(() => import('../build/error-500-DE5RylDA.mjs'));
		const ErrorTemplate = is404 ? _Error404 : _Error;
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(unref(ErrorTemplate), mergeProps({
				status: unref(status),
				statusText: unref(statusText),
				statusCode: unref(status),
				statusMessage: unref(statusText),
				description: unref(description),
				stack: unref(stack)
			}, _attrs), null, _parent));
		};
	}
};
var _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("node_modules/nuxt/dist/app/components/nuxt-error-page.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fisland-renderer.mjs
var IslandRenderer = () => null;
//#endregion
//#region node_modules/nuxt/dist/app/components/nuxt-root.vue
var _sfc_main = {
	__name: "nuxt-root",
	__ssrInlineRender: true,
	setup(__props) {
		const nuxtApp = useNuxtApp();
		nuxtApp.deferHydration();
		nuxtApp.ssrContext.url;
		const SingleRenderer = false;
		provide(PageRouteSymbol, useRoute());
		nuxtApp.hooks.callHookWith((hooks) => hooks.map((hook) => hook()), "vue:setup", []);
		const error = /* @__PURE__ */ useError();
		const abortRender = error.value && !nuxtApp.ssrContext.error;
		function invokeAppErrorHandler(err, target, info) {
			const errorHandler = nuxtApp.vueApp.config.errorHandler;
			if (errorHandler && !errorHandler.__nuxt_default) try {
				errorHandler(err, target, info);
			} catch (handlerError) {
				console.error("[nuxt] Error in `app.config.errorHandler`", handlerError);
			}
		}
		onErrorCaptured((err, target, info) => {
			nuxtApp.hooks.callHook("vue:error", err, target, info)?.catch((hookError) => console.error("[nuxt] Error in `vue:error` hook", hookError));
			{
				const p = nuxtApp.runWithContext(() => showError(err));
				onServerPrefetch(() => p);
				invokeAppErrorHandler(err, target, info);
				return false;
			}
		});
		const islandContext = nuxtApp.ssrContext.islandContext;
		return (_ctx, _push, _parent, _attrs) => {
			ssrRenderSuspense(_push, {
				default: () => {
					if (unref(abortRender)) _push(`<div></div>`);
					else if (unref(error)) _push(ssrRenderComponent(unref(_sfc_main$1), { error: unref(error) }, null, _parent));
					else if (unref(islandContext)) _push(ssrRenderComponent(unref(IslandRenderer), { context: unref(islandContext) }, null, _parent));
					else if (unref(SingleRenderer)) ssrRenderVNode(_push, createVNode(resolveDynamicComponent(unref(SingleRenderer)), null, null), _parent);
					else _push(ssrRenderComponent(unref(app_default), null, null, _parent));
				},
				_: 1
			});
		};
	}
};
var _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("node_modules/nuxt/dist/app/components/nuxt-root.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
//#endregion
//#region node_modules/nuxt/dist/app/entry.js
var entry$1 = async function createNuxtAppServer(ssrContext) {
	const vueApp = createApp(_sfc_main);
	const nuxt = createNuxtApp({
		vueApp,
		ssrContext
	});
	try {
		await applyPlugins(nuxt, virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fplugins_server_default);
		await nuxt.hooks.callHook("app:created", vueApp);
	} catch (error) {
		await nuxt.hooks.callHook("app:error", error);
		nuxt.payload.error ||= createError$1(error);
	}
	if (ssrContext && (ssrContext["~renderResponse"] || ssrContext._renderResponse)) throw new Error("skipping render");
	return vueApp;
};
var entry_default = ((ssrContext) => entry$1(ssrContext));

const entry = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: entry_default
}, Symbol.toStringTag, { value: 'Module' }));

export { useRouter as a, useRuntimeConfig as b, useNuxtApp as c, nuxtLinkDefaults as d, encodeRoutePath as e, entry as f, navigateTo as n, resolveRouteObject as r, useHead$1 as u };;globalThis.__timing__.logEnd('Load chunks/virtual/entry');
//# sourceMappingURL=entry.mjs.map
