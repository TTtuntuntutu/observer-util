import { runAsReaction } from './reactionRunner'
import { releaseReaction } from './store'

const IS_REACTION = Symbol('is reaction') // 标记：已经变成响应式observer

// 开启
export function observe (fn, options = {}) {
  // 对于observe fn，如果没有包装，会包装一下
  const reaction = fn[IS_REACTION]
    ? fn
    : function reaction () {
      return runAsReaction(reaction, fn, this, arguments)
    }
  
  // 理解为勾子：save the scheduler and debugger on the reaction
  reaction.scheduler = options.scheduler
  reaction.debugger = options.debugger

  // 打上已包装的标记
  reaction[IS_REACTION] = true

  // 在创建的时候是否执行一下以变成响应式
  // 如果为true，则要手动执行一下fn，因为包装的逻辑runAsReaction没有执行过
  if (!options.lazy) {
    reaction()
  }

  return reaction
}

// 关闭
export function unobserve (reaction) {
  // do nothing, if the reaction is already unobserved
  if (!reaction.unobserved) {
    // indicate that the reaction should not be triggered any more
    reaction.unobserved = true
    // release (obj -> key -> reaction) connections
    releaseReaction(reaction)
  }
  // unschedule the reaction, if it is scheduled
  if (typeof reaction.scheduler === 'object') {
    reaction.scheduler.delete(reaction)
  }
}
