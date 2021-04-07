import { observable } from './observable'
import { proxyToRaw, rawToProxy } from './internals'
import {
  registerRunningReactionForOperation,
  queueReactionsForOperation,
  hasRunningReaction
} from './reactionRunner'

const hasOwnProperty = Object.prototype.hasOwnProperty
const wellKnownSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => Symbol[key])
    .filter(value => typeof value === 'symbol')
)

// ---------------- 要求在RunningReaction内------

// 劫持Get方法，收集依赖/响应
function get(target, key, receiver) {
  // 先获得真实的属性值
  const result = Reflect.get(target, key, receiver)

  // 校检一下，不要用周所周知的Symbols做key
  if (typeof key === 'symbol' && wellKnownSymbols.has(key)) {
    return result
  }

  // 待定一下：register and save (observable.prop -> runningReaction)
  registerRunningReactionForOperation({ target, key, receiver, type: 'get' })

  // if we are inside a reaction and observable.prop is an object wrap it in an observable too
  // this is needed to intercept property access on that object too (dynamic observable tree)
  const observableResult = rawToProxy.get(result)

  if (hasRunningReaction() && typeof result === 'object' && result !== null) {
    // 如果result是对象且包装过直接返回
    if (observableResult) {
      return observableResult
    }
    // do not violate the none-configurable none-writable prop get handler invariant
    // fall back to none reactive mode in this case, instead of letting the Proxy throw a TypeError
    const descriptor = Reflect.getOwnPropertyDescriptor(target, key)
    if (
      !descriptor ||
      !(descriptor.writable === false && descriptor.configurable === false)
    ) {
      return observable(result)
    }
  }

  // otherwise return the observable wrapper if it is already created and cached or the raw object
  return observableResult || result
}

function has (target, key) {
  const result = Reflect.has(target, key)
  // register and save (observable.prop -> runningReaction)
  registerRunningReactionForOperation({ target, key, type: 'has' })
  return result
}

function ownKeys (target) {
  registerRunningReactionForOperation({ target, type: 'iterate' })
  return Reflect.ownKeys(target)
}

// ----------------

// 劫持Set方法，在时间点取触发reactions
function set (target, key, value, receiver) {
  // make sure to do not pollute the raw object with observables
  // value值处理：如果value是对象，拿到的是原始数据，而不是包装后的
  if (typeof value === 'object' && value !== null) {
    value = proxyToRaw.get(value) || value
  }


  const hadKey = hasOwnProperty.call(target, key)

  // save if the value changed because of this set operation
  const oldValue = target[key]
  
  // 在执行reaction之前做一下原本的set操作
  const result = Reflect.set(target, key, value, receiver)
  
  // do not queue reactions if the target of the operation is not the raw receiver
  // (possible because of prototypal inheritance)
  if (target !== proxyToRaw.get(receiver)) {
    return result
  }

  // 准备响应，分新增和设置两种情况
  if (!hadKey) {
    queueReactionsForOperation({ target, key, value, receiver, type: 'add' })
  } else if (value !== oldValue) {
    queueReactionsForOperation({
      target,
      key,
      value,
      oldValue,
      receiver,
      type: 'set'
    })
  }

  return result
}

function deleteProperty (target, key) {
  // save if the object had the key
  const hadKey = hasOwnProperty.call(target, key)
  const oldValue = target[key]
  // execute the delete operation before running any reaction
  const result = Reflect.deleteProperty(target, key)
  // only queue reactions for delete operations which resulted in an actual change
  if (hadKey) {
    queueReactionsForOperation({ target, key, oldValue, type: 'delete' })
  }
  return result
}

export default { get, has, ownKeys, set, deleteProperty }
