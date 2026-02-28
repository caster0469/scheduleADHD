import { FormEvent, useEffect, useMemo, useState } from 'react';

type Tab = 'home' | 'calendar' | 'todo';
type ItemType = 'task' | 'move' | 'event' | 'deadline';
type CategorySize = 'sm' | 'md' | 'lg';

type Item = {
  id: string;
  type: ItemType;
  category: string;
  title: string;
  date: string;
  time: string | null;
  memo: string | null;
  done: boolean;
};

type Todo = {
  id: string;
  emoji: string;
  label: string;
  title: string;
  sub: string | null;
  done: boolean;
};

type ItemDraft = {
  type: ItemType;
  category: string;
  title: string;
  date: string;
  time: string;
  memo: string;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const categoryMap: Record<string, { emoji: string; label: string }> = {
  study: { emoji: '📓', label: '勉強' },
  meal: { emoji: '🍚', label: '食事' },
  move: { emoji: '🚶', label: '移動' },
  bath: { emoji: '🛁', label: '風呂' },
  message: { emoji: '💬', label: '連絡' },
  chores: { emoji: '🧺', label: '家事' },
  rest: { emoji: '🛌', label: '休憩' },
  hobby: { emoji: '🎮', label: '趣味' }
};

const itemTypeLabel: Record<ItemType, string> = {
  task: '作業',
  move: '移動',
  event: '予定',
  deadline: '締切'
};

function todayString() {
  return toDateStringLocal(new Date());
}

function toDateStringLocal(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateString(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addMonths(date: string, diff: number) {
  const d = parseDateString(date);
  return toDateStringLocal(new Date(d.getFullYear(), d.getMonth() + diff, 1));
}

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [items, setItems] = useState<Item[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [draftOpen, setDraftOpen] = useState(false);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoSub, setTodoSub] = useState('');
  const [submittingTodo, setSubmittingTodo] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft>({
    type: 'task',
    category: 'study',
    title: '',
    date: todayString(),
    time: '',
    memo: ''
  });

  const isDesktop = window.matchMedia('(min-width: 768px)').matches;

  const today = todayString();
  const currentMonth = selectedDate.slice(0, 7);

  async function fetchItems() {
    const res = await fetch(`${API_BASE}/api/items`);
    const json = (await res.json()) as Item[];
    setItems(
      [...json].sort((a, b) => `${a.date}-${a.time ?? '99:99'}-${a.id}`.localeCompare(`${b.date}-${b.time ?? '99:99'}-${b.id}`))
    );
  }

  async function fetchTodos() {
    const res = await fetch(`${API_BASE}/api/todos`);
    setTodos(await res.json());
  }

  async function refreshAll() {
    await Promise.all([fetchItems(), fetchTodos()]);
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  const todayItems = useMemo(
    () => items.filter((item) => item.date === today).sort((a, b) => `${a.time ?? '99:99'}-${a.id}`.localeCompare(`${b.time ?? '99:99'}-${b.id}`)),
    [items, today]
  );
  const dayItems = useMemo(
    () => items.filter((item) => item.date === selectedDate).sort((a, b) => `${a.time ?? '99:99'}-${a.id}`.localeCompare(`${b.time ?? '99:99'}-${b.id}`)),
    [items, selectedDate]
  );

  async function addItem(e: FormEvent) {
    e.preventDefault();
    const title = itemDraft.title.trim();
    if (!title || submittingItem) return;
    setSubmittingItem(true);
    try {
      const payload = {
        ...itemDraft,
        title,
        time: itemDraft.time || null,
        memo: itemDraft.memo.trim() || null,
        done: false
      };
      const res = await fetch(`${API_BASE}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) return;
      setItemDraft((prev) => ({ ...prev, title: '', time: '', memo: '' }));
      setDraftOpen(false);
      await fetchItems();
    } finally {
      setSubmittingItem(false);
    }
  }

  async function toggleItemDone(item: Item) {
    await fetch(`${API_BASE}/api/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !item.done })
    });
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, done: !it.done } : it)));
  }

  async function deleteTodo(id: string) {
    await fetch(`${API_BASE}/api/todos/${id}`, { method: 'DELETE' });
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }

  async function toggleTodo(id: string, done: boolean) {
    await fetch(`${API_BASE}/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done })
    });
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, done: !done } : todo)));
  }

  async function createTodo(e: FormEvent) {
    e.preventDefault();
    const title = todoTitle.trim();
    if (!title || submittingTodo) return;
    if (todos.some((todo) => !todo.done && todo.title.trim() === title)) return;
    setSubmittingTodo(true);
    try {
      const res = await fetch(`${API_BASE}/api/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: '📝', label: 'TODO', title, sub: todoSub.trim() || null })
      });
      if (!res.ok) return;
      setTodoTitle('');
      setTodoSub('');
      await fetchTodos();
    } finally {
      setSubmittingTodo(false);
    }
  }

  return (
    <div className="app">
      <aside className="sideNav">
        <button onClick={() => setTab('home')} className={tab === 'home' ? 'active' : ''}>🏠 ホーム</button>
        <button onClick={() => setTab('calendar')} className={tab === 'calendar' ? 'active' : ''}>📅 カレンダー</button>
        <button onClick={() => setTab('todo')} className={tab === 'todo' ? 'active' : ''}>✅ TODO</button>
      </aside>

      <main className="main">
        {tab === 'home' && (
          <section>
            <h1>今日のフロー</h1>
            <div className="rail" />
            {todayItems.map((item) => (
              <FlowNode key={item.id} item={item} onToggleDone={() => toggleItemDone(item)} size={isDesktop ? 'lg' : 'md'} />
            ))}
            {todayItems.length === 0 && <p className="empty">今日の予定はまだありません。</p>}
            <button className="addBtn" onClick={() => { setItemDraft((prev) => ({ ...prev, date: today })); setDraftOpen(true); }}>＋ 予定を追加</button>
          </section>
        )}

        {tab === 'calendar' && (
          <CalendarView
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            allItems={items}
            dayItems={dayItems}
            onChangeMonth={(diff) => {
              const first = addMonths(`${currentMonth}-01`, diff);
              const nextDate = `${first.slice(0, 7)}-${selectedDate.slice(8, 10)}`;
              const parsed = parseDateString(nextDate);
              if (parsed.getMonth() + 1 === Number(first.slice(5, 7))) {
                setSelectedDate(nextDate);
              } else {
                setSelectedDate(first);
              }
            }}
            onSelectDate={setSelectedDate}
            onAdd={() => { setItemDraft((prev) => ({ ...prev, date: selectedDate })); setDraftOpen(true); }}
            onToggleDone={toggleItemDone}
          />
        )}

        {tab === 'todo' && (
          <section>
            <h1>TODO</h1>
            <form className="todoCreate" onSubmit={createTodo}>
              <input value={todoTitle} onChange={(e) => setTodoTitle(e.target.value)} placeholder="TODOタイトル" maxLength={80} />
              <input value={todoSub} onChange={(e) => setTodoSub(e.target.value)} placeholder="メモ（任意）" maxLength={120} />
              <button type="submit" disabled={submittingTodo}>＋ 追加</button>
            </form>
            {todos.map((t) => (
              <div className={`todoRow ${t.done ? 'isDone' : ''}`} key={t.id}>
                <CategoryObject emoji={t.emoji} label={t.label} size={isDesktop ? 'md' : 'sm'} />
                <div className="todoContent">
                  <strong>{t.title}</strong>
                  {t.sub && <p>{t.sub}</p>}
                </div>
                <div className="todoActions">
                  <button className="iconBtn" onClick={() => toggleTodo(t.id, t.done)}>{t.done ? '↩' : '✓'}</button>
                  <button className="iconBtn delete" onClick={() => deleteTodo(t.id)}>✕</button>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>

      <aside className="detailPanel">
        <h3>選択日</h3>
        <p>{selectedDate}</p>
        <p>予定: {dayItems.length}件</p>
      </aside>

      {!isDesktop && (
        <nav className="bottomNav">
          <button onClick={() => setTab('home')} className={tab === 'home' ? 'active' : ''}>ホーム</button>
          <button onClick={() => setTab('calendar')} className={tab === 'calendar' ? 'active' : ''}>カレンダー</button>
          <button onClick={() => setTab('todo')} className={tab === 'todo' ? 'active' : ''}>TODO</button>
        </nav>
      )}

      {draftOpen && (
        <div className="sheetBackdrop" onClick={() => setDraftOpen(false)}>
          <form className="sheet" onSubmit={addItem} onClick={(e) => e.stopPropagation()}>
            <h3>予定を追加</h3>
            <select value={itemDraft.type} onChange={(e) => setItemDraft({ ...itemDraft, type: e.target.value as ItemType })}>
              {(['task', 'move', 'event', 'deadline'] as ItemType[]).map((t) => <option key={t} value={t}>{itemTypeLabel[t]}</option>)}
            </select>
            <select value={itemDraft.category} onChange={(e) => setItemDraft({ ...itemDraft, category: e.target.value })}>
              {Object.keys(categoryMap).map((key) => <option key={key} value={key}>{categoryMap[key].label}</option>)}
            </select>
            <input placeholder="タイトル" value={itemDraft.title} onChange={(e) => setItemDraft({ ...itemDraft, title: e.target.value })} maxLength={80} required />
            <input type="date" value={itemDraft.date} onChange={(e) => setItemDraft({ ...itemDraft, date: e.target.value })} required />
            <input type="time" value={itemDraft.time} onChange={(e) => setItemDraft({ ...itemDraft, time: e.target.value })} />
            <input placeholder="メモ（任意）" value={itemDraft.memo} onChange={(e) => setItemDraft({ ...itemDraft, memo: e.target.value })} maxLength={120} />
            <button type="submit" disabled={submittingItem}>追加</button>
          </form>
        </div>
      )}
    </div>
  );
}

function FlowNode({ item, onToggleDone, size }: { item: Item; onToggleDone: () => void; size: CategorySize }) {
  const cat = categoryMap[item.category] ?? { emoji: '📝', label: item.category };
  return (
    <article className={`node ${item.type} ${item.done ? 'isDone' : ''}`}>
      <div className="time">{item.time ?? '--:--'}</div>
      <div className="card">
        <CategoryObject emoji={cat.emoji} label={cat.label} size={size} />
        <div>
          <h3>{item.title}</h3>
          <p>{item.memo || itemTypeLabel[item.type]}</p>
        </div>
        <button className="doneToggle" onClick={onToggleDone} aria-label="完了切り替え">{item.done ? '✓' : '○'}</button>
      </div>
    </article>
  );
}

function CategoryObject({ emoji, label, size }: { emoji: string; label: string; size: CategorySize }) {
  return (
    <div className={`catObj ${size}`}>
      <span className="catLabel">{label}</span>
      <span className="catEmoji">{emoji}</span>
    </div>
  );
}

function CalendarView({
  currentMonth,
  selectedDate,
  allItems,
  dayItems,
  onChangeMonth,
  onSelectDate,
  onAdd,
  onToggleDone
}: {
  currentMonth: string;
  selectedDate: string;
  allItems: Item[];
  dayItems: Item[];
  onChangeMonth: (diff: number) => void;
  onSelectDate: (date: string) => void;
  onAdd: () => void;
  onToggleDone: (item: Item) => void;
}) {
  const [y, m] = currentMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - startWeekday + 1;
    if (day <= 0 || day > daysInMonth) return null;
    return `${currentMonth}-${`${day}`.padStart(2, '0')}`;
  });

  const itemByDate = new Map<string, Item[]>();
  allItems.forEach((item) => {
    if (!itemByDate.has(item.date)) itemByDate.set(item.date, []);
    itemByDate.get(item.date)?.push(item);
  });

  return (
    <section>
      <h1>カレンダー</h1>
      <div className="monthHead">
        <button onClick={() => onChangeMonth(-1)}>← 前月</button>
        <strong>{currentMonth}</strong>
        <button onClick={() => onChangeMonth(1)}>次月 →</button>
      </div>
      <div className="calendarLayout">
        <div className="grid">
          {['日', '月', '火', '水', '木', '金', '土'].map((day) => <div key={day} className="weekday">{day}</div>)}
          {cells.map((date, i) => {
            const dayItemsForDate = date ? itemByDate.get(date) ?? [] : [];
            const dotType = dayItemsForDate[0]?.type;
            return (
              <button key={`${date ?? 'blank'}-${i}`} className={date === selectedDate ? 'active' : ''} disabled={!date} onClick={() => date && onSelectDate(date)}>
                {date ? Number(date.slice(-2)) : ''}
                {date && dayItemsForDate.length > 0 && <span className={`dot ${dotType}`} />}
              </button>
            );
          })}
        </div>
        <div className="dayList">
          <h3>{selectedDate}</h3>
          {dayItems.map((item) => (
            <div key={item.id} className={`mini ${item.done ? 'isDone' : ''}`}>
              <span>{item.time ?? '--:--'} {item.title}</span>
              <button className="iconBtn" onClick={() => onToggleDone(item)}>{item.done ? '↩' : '✓'}</button>
            </div>
          ))}
          {dayItems.length === 0 && <p className="empty">この日の予定はありません。</p>}
          <button className="addBtn" onClick={onAdd}>＋ 追加</button>
        </div>
      </div>
    </section>
  );
}
