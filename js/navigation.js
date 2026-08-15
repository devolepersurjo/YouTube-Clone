export class NavigationManager {
  constructor(appInstance) {
    this.app = appInstance;
    this.historyStack = ['home'];
    this._setupPopState();
  }

  _setupPopState() {
    window.addEventListener('popstate', (e) => {
      if (this.app.isPlayerOpen) {
        this.app.closePlayerView(false);
        return;
      }

      if (this.app.isBottomSheetOpen) {
        this.app.closeBottomSheet(false);
        return;
      }

      if (this.historyStack.length > 1) {
        this.historyStack.pop();
        const previousTab = this.historyStack[this.historyStack.length - 1];
        this.app.switchTab(previousTab, false);
      }
    });
  }

  pushState(tabName) {
    if (this.historyStack[this.historyStack.length - 1] !== tabName) {
      this.historyStack.push(tabName);
      window.history.pushState({ tab: tabName }, '', `#${tabName}`);
    }
  }
}