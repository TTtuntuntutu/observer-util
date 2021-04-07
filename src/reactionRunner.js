import {
  registerReactionForOperation,
  getReactionsForOperation,
  releaseReaction
} from './store'

// reactions can call each other and form a call stack
const reactionStack = []
let isDebugging = false

export function runAsReaction (reaction, fn, context, args) {
  // 如果是unobserved的标记，就不做响应式处理了
  if (reaction.unobserved) {
    return Reflect.apply(fn, context, args)
  }

  // only run the reaction if it is not already in the reaction stack
  // TODO: improve this to allow explicitly recursive reactions
  if (reactionStack.indexOf(reaction) === -1) {
    // release the (obj -> key -> reactions) connections
    // and reset the cleaner connections
    releaseReaction(reaction)

    try {
      // 执行前：加入reactionStack
      reactionStack.push(reaction)
      // 执行中
      return Reflect.apply(fn, context, args)
    } finally {
      // 执行后：从stack剔除
      reactionStack.pop()
    }
  }
}

// 这个函数是和runAsReaction配合执行的，做好依赖收集
export function registerRunningReactionForOperation (operation) {
  // 取最新的runningReaction
  const runningReaction = reactionStack[reactionStack.length - 1]

  if (runningReaction) {
    // 执行一下debug勾子
    debugOperation(runningReaction, operation)
    // 依赖收集
    registerReactionForOperation(runningReaction, operation)
  }
}

export function queueReactionsForOperation (operation) {
  // iterate and queue every reaction, which is triggered by obj.key mutation
  getReactionsForOperation(operation).forEach(queueReaction, operation)
}

function queueReaction (reaction) {
  debugOperation(reaction, this)
  // queue the reaction for later execution or run it immediately
  if (typeof reaction.scheduler === 'function') {
    reaction.scheduler(reaction)
  } else if (typeof reaction.scheduler === 'object') {
    reaction.scheduler.add(reaction)
  } else {
    reaction()
  }
}

function debugOperation (reaction, operation) {
  if (reaction.debugger && !isDebugging) {
    try {
      isDebugging = true
      reaction.debugger(operation)
    } finally {
      isDebugging = false
    }
  }
}

export function hasRunningReaction () {
  return reactionStack.length > 0
}
