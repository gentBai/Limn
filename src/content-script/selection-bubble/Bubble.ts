import bubbleCss from './bubble.css?raw';

/**
 * 划词翻译气泡。使用 Shadow DOM 隔离样式。
 * 监听 mouseup，在选区附近浮现"翻译"按钮；点击后调用翻译并展示结果。
 */
export class TranslateBubble {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private bubble: HTMLDivElement;

  constructor(
    private translate: (text: string, onDelta?: (partial: string) => void) => Promise<string>
  ) {
    this.host = document.createElement('div');
    this.host.id = 'ai-reader-bubble-host';
    this.host.className = 'ar-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `<style>${bubbleCss}</style><div class="ar-bubble" hidden></div>`;
    document.body.appendChild(this.host);
    this.bubble = this.shadow.querySelector('.ar-bubble') as HTMLDivElement;
    document.addEventListener('mouseup', this.onMouseUp);
  }

  /** 判断事件是否发生在气泡内部（点击气泡本身时不应隐藏/重置） */
  private isOnBubble(e: MouseEvent): boolean {
    // composedPath 能穿透 Shadow DOM 边界
    return e.composedPath().includes(this.host);
  }

  private onMouseUp = (e: MouseEvent) => {
    // 点击气泡本身产生的 mouseup 不应触发选区重判
    if (this.isOnBubble(e)) return;

    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (text.length < 2 || text.length > 1000) {
      this.bubble.hidden = true;
      return;
    }
    const range = sel!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    this.bubble.hidden = false;
    this.bubble.classList.remove('ar-expanded');
    this.bubble.style.top = `${rect.top + window.scrollY - 36}px`;
    this.bubble.style.left = `${rect.left + window.scrollX + rect.width / 2 - 30}px`;
    this.bubble.textContent = '🌐 翻译';
    this.bubble.onclick = async () => {
      this.bubble.textContent = '...';
      this.bubble.classList.add('ar-expanded');
      try {
        const translated = await this.translate(text, (partial) => {
          // 流式逐字更新气泡
          this.bubble.textContent = partial.slice(0, 200);
        });
        this.bubble.textContent = translated.slice(0, 200);
        this.bubble.classList.add('ar-expanded');
      } catch {
        this.bubble.textContent = '翻译失败';
      }
    };
  };

  destroy() {
    document.removeEventListener('mouseup', this.onMouseUp);
    this.host.remove();
  }
}
