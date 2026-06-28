import bubbleCss from './bubble.css?raw';
import { t } from '@/i18n';

/**
 * Ask-AI bubble. Uses Shadow DOM for style isolation.
 * Listens to mouseup, shows an "ask" button near the selection; on click,
 * asks the AI to interpret the selected text and shows the full reply.
 */
export class AskBubble {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private bubble: HTMLDivElement;

  constructor(
    private ask: (text: string, onDelta?: (partial: string) => void) => Promise<string>
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

  /** Detect whether the event occurred inside the bubble (clicking the bubble should not reset selection) */
  private isOnBubble(e: MouseEvent): boolean {
    // composedPath penetrates Shadow DOM boundary
    return e.composedPath().includes(this.host);
  }

  private onMouseUp = (e: MouseEvent) => {
    // mouseup from clicking the bubble itself should not trigger selection re-evaluation
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
    this.bubble.textContent = t('bubble.ask');
    this.bubble.onclick = async () => {
      this.bubble.textContent = t('bubble.asking');
      this.bubble.classList.add('ar-expanded');
      try {
        const answer = await this.ask(text, (partial) => {
          // Stream-fill the bubble with the full reply (no truncation)
          this.bubble.textContent = partial;
        });
        this.bubble.textContent = answer;
        this.bubble.classList.add('ar-expanded');
      } catch {
        this.bubble.textContent = t('bubble.failed');
      }
    };
  };

  destroy() {
    document.removeEventListener('mouseup', this.onMouseUp);
    this.host.remove();
  }
}
