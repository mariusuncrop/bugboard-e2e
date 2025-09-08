import type { Locator, Page } from '@playwright/test';

export type Status = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';

export class BoardPage {
  readonly board: Locator;
  readonly loading: Locator;
  readonly assigneeFilter: Locator;
  readonly priorityFilter: Locator;

  constructor(readonly page: Page) {
    this.board = page.getByTestId('board');
    this.loading = page.getByTestId('board-loading');
    this.assigneeFilter = page.getByTestId('board-filter-assignee');
    this.priorityFilter = page.getByTestId('board-filter-priority');
  }

  async goto(): Promise<void> {
    await this.page.goto('/board');
    await this.board.waitFor();
  }

  column(status: Status): Locator {
    return this.page.getByTestId(`column-${status}`);
  }

  columnCount(status: Status): Locator {
    return this.page.getByTestId(`column-count-${status}`);
  }

  card(issueKey: string): Locator {
    return this.page.getByTestId(`issue-card-${issueKey}`);
  }

  cardsIn(status: Status): Locator {
    return this.column(status).locator('[data-issue-key]');
  }

  /** The accessible alternative to dragging — a select on each card. */
  async moveViaSelect(issueKey: string, status: Status): Promise<void> {
    await this.page.getByTestId(`move-${issueKey}`).selectOption(status);
    await this.card(issueKey).waitFor();
  }

  /**
   * The real gesture: HTML5 drag and drop from a card onto a column.
   *
   * `locator.dragTo()` is the obvious call here, and it is intermittently
   * unreliable for native HTML5 drag and drop — the browser needs several
   * mouse moves after the button goes down before it treats the gesture as a
   * drag and starts firing `dragover` on the target. Driving the mouse by hand
   * makes that explicit, and makes the test stable.
   */
  async dragCardTo(issueKey: string, status: Status): Promise<void> {
    const source = this.card(issueKey);
    const target = this.page.getByTestId(`column-body-${status}`);

    await target.scrollIntoViewIfNeeded();
    await source.scrollIntoViewIfNeeded();

    const from = await source.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error(`Cannot drag ${issueKey} to ${status}: an element has no box.`);

    // Columns are tall and the board scrolls both ways, so the middle of the
    // target box is often outside the viewport — where a mouse move does
    // nothing and the drag silently fails. Aim at the visible part instead.
    const viewport = this.page.viewportSize() ?? { width: 1280, height: 720 };
    const left = Math.max(to.x, 0);
    const right = Math.min(to.x + to.width, viewport.width);
    const top = Math.max(to.y, 0);
    const bottom = Math.min(to.y + to.height, viewport.height);

    if (right - left < 20 || bottom - top < 20) {
      throw new Error(
        `The "${status}" column is scrolled out of view at ${viewport.width}x${viewport.height}, so it ` +
          'cannot be dropped on. Drag to a visible column, or use moveViaSelect for a long-distance move.',
      );
    }

    const dropX = (left + right) / 2;
    const dropY = (top + bottom) / 2;

    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    // The first move starts the drag; the second lands a dragover on the target.
    await this.page.mouse.move(dropX, dropY, { steps: 12 });
    await this.page.mouse.move(dropX, dropY + 4, { steps: 4 });
    await this.page.mouse.up();
  }

  async filterByAssignee(value: string): Promise<void> {
    await this.assigneeFilter.selectOption(value);
  }

  async filterByPriority(value: string): Promise<void> {
    await this.priorityFilter.selectOption(value);
  }
}
