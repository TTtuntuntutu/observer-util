/**
 * Observable架构搭建
 */
import { proxyToRaw, rawToProxy } from './internals'
import { storeObservable } from './store'
import * as builtIns from './builtIns'
import baseHandlers from './handlers'

// 入参一定是一个引用类型？
export function observable (obj = {}) {
  // 已经Observable创建过了 Or 意料之外的情况 => 不做Proxy包装，直接返回
  if (proxyToRaw.has(obj) || !builtIns.shouldInstrument(obj)) {
    return obj
  }

  // 已经包装过了，直接返回 Or 没有包装过的，重新创建一下
  return rawToProxy.get(obj) || createObservable(obj)
}

// 创建Observable：搭好了架子，做好了准备工作
function createObservable (obj) {
  // 找到预先准备好的handlers
  const handlers = builtIns.getHandlers(obj) || baseHandlers
  // 包装成Proxy
  const observable = new Proxy(obj, handlers)

  // 在两个全局的WeakMap记录一下
  rawToProxy.set(obj, observable)
  proxyToRaw.set(observable, obj)

  // 在store的WeakMap中以obj为key，value为一个空的Map
  storeObservable(obj)

  return observable
}

export function isObservable (obj) {
  return proxyToRaw.has(obj)
}

export function raw (obj) {
  return proxyToRaw.get(obj) || obj
}
