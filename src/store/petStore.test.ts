import { beforeEach, describe, expect, it } from 'vitest'
import { usePetStore } from './petStore'

describe('quick panel state', () => {
  beforeEach(() => usePetStore.setState({ isQuickPanelOpen: false }))

  it('toggles independently from chat visibility', () => {
    const store = usePetStore.getState()
    store.toggleQuickPanel()
    expect(usePetStore.getState()).toMatchObject({ isQuickPanelOpen: true, isChatOpen: false })
    usePetStore.getState().setChatOpen(true)
    usePetStore.getState().setQuickPanelOpen(false)
    expect(usePetStore.getState()).toMatchObject({ isQuickPanelOpen: false, isChatOpen: true })
  })
})
