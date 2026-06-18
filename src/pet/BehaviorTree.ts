import type { PetState, PetAction } from './types'

// ============================================
// 行为树系统
// ============================================

type BehaviorStatus = 'running' | 'success' | 'failure'

interface BehaviorNode {
  tick(state: PetState, deltaMs: number): BehaviorStatus
}

// ---- 叶子节点 ----

/** 执行一个动作 */
class ActionNode implements BehaviorNode {
  private action: PetAction
  private duration: number
  private elapsed = 0

  constructor(action: PetAction, durationMs: number) {
    this.action = action
    this.duration = durationMs
  }

  tick(_state: PetState, deltaMs: number): BehaviorStatus {
    this.elapsed += deltaMs
    if (this.elapsed >= this.duration) {
      this.elapsed = 0
      return 'success'
    }
    return 'running'
  }

  get currentAction(): PetAction {
    return this.action
  }
}

// ---- 组合节点 ----

/** 顺序执行（全部成功才算成功） */
class SequenceNode implements BehaviorNode {
  private children: BehaviorNode[]
  private currentIndex = 0

  constructor(children: BehaviorNode[]) {
    this.children = children
  }

  tick(state: PetState, deltaMs: number): BehaviorStatus {
    if (this.currentIndex >= this.children.length) {
      this.currentIndex = 0
      return 'success'
    }

    const status = this.children[this.currentIndex].tick(state, deltaMs)
    if (status === 'success') {
      this.currentIndex++
      if (this.currentIndex >= this.children.length) {
        this.currentIndex = 0
        return 'success'
      }
      return 'running'
    }
    if (status === 'failure') {
      this.currentIndex = 0
      return 'failure'
    }
    return 'running'
  }
}

/** 选择执行（一个成功就算成功） */
class SelectorNode implements BehaviorNode {
  private children: BehaviorNode[]
  private currentIndex = 0

  constructor(children: BehaviorNode[]) {
    this.children = children
  }

  tick(state: PetState, deltaMs: number): BehaviorStatus {
    if (this.currentIndex >= this.children.length) {
      this.currentIndex = 0
      return 'failure'
    }

    const status = this.children[this.currentIndex].tick(state, deltaMs)
    if (status === 'success') {
      this.currentIndex = 0
      return 'success'
    }
    if (status === 'failure') {
      this.currentIndex++
      return this.tick(state, deltaMs)
    }
    return 'running'
  }
}

/** 条件判断 */
class ConditionNode implements BehaviorNode {
  private fn: (state: PetState) => boolean

  constructor(fn: (state: PetState) => boolean) {
    this.fn = fn
  }

  tick(state: PetState): BehaviorStatus {
    return this.fn(state) ? 'success' : 'failure'
  }
}

// ---- 辅助函数 ----

/** 判断宠物是否靠近 Canvas 边缘 */
function isNearEdge(state: PetState, threshold = 40): boolean {
  const { x, y } = state.position
  return x < threshold || x > 260 || y < threshold || y > 310
}

// ---- 行为树 ----

export class BehaviorTree {
  private root: SelectorNode
  private currentNode: BehaviorNode
  private _currentAction: PetAction = 'idle_stand'

  constructor() {
    // 定义行为树
    this.root = new SelectorNode([
      // 分支1：用户正在拖拽 → 站立
      new SequenceNode([
        new ConditionNode((s) => s.isDragging),
        new ActionNode('idle_stand', 100),
      ]),
      // 分支2：对话打开 → 思考
      new SequenceNode([
        new ConditionNode((s) => s.isChatOpen),
        new ActionNode('think', 200),
      ]),
      // 分支3：靠近边缘 → 停下来站好（防止走出屏幕）
      new SequenceNode([
        new ConditionNode((s) => isNearEdge(s)),
        new ActionNode('idle_stand', 2000),
      ]),
      // 分支4：闲置很久 → 打盹
      new SequenceNode([
        new ConditionNode((s) => Date.now() - s.lastInteractionTime > 300_000),
        new ActionNode('sleep', 5000),
      ]),
      // 分支5：闲置一会 → 走来走去
      new SequenceNode([
        new ConditionNode((s) => Date.now() - s.lastInteractionTime > 30_000),
        new ActionNode('walk_right', 2000),
        new ActionNode('idle_stand', 3000),
        new ActionNode('walk_left', 2000),
        new ActionNode('idle_breathe', 5000),
      ]),
      // 兜底：站立呼吸
      new ActionNode('idle_breathe', 3000),
    ])

    this.currentNode = this.root
  }

  get currentAction(): PetAction {
    return this._currentAction
  }

  tick(state: PetState, deltaMs: number): PetAction {
    const status = this.currentNode.tick(state, deltaMs)
    if (status !== 'running') {
      // 重新从根节点开始
      this.currentNode = this.root
    }

    // 读取当前执行的动作
    if (this.currentNode instanceof ActionNode) {
      this._currentAction = (this.currentNode as ActionNode)['currentAction']
    }

    return this._currentAction
  }
}
