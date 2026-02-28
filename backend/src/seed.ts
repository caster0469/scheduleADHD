import { prisma } from './db.js';

const today = new Date();
const yyyy = today.getFullYear();
const mm = `${today.getMonth() + 1}`.padStart(2, '0');
const dd = `${today.getDate()}`.padStart(2, '0');
const date = `${yyyy}-${mm}-${dd}`;

async function main() {
  const count = await prisma.item.count();
  if (count > 0) return;

  await prisma.item.createMany({
    data: [
      { type: 'task', category: 'study', title: '勉強', date, time: '15:30', durationMin: 55, firstStep: 'ノートを開く' },
      { type: 'move', category: 'move', title: '移動', date, time: '17:30', durationMin: 15, firstStep: '玄関の準備' },
      { type: 'event', category: 'meal', title: '食事', date, time: '18:00', durationMin: 30 },
      { type: 'deadline', category: 'chores', title: '課題提出', date, time: '19:30', firstStep: '提出ページを開く' }
    ]
  });

  await prisma.todo.createMany({
    data: [
      { emoji: '📓', label: '勉強', title: '英単語20個', sub: '単語帳の1ページ' },
      { emoji: '🧺', label: '家事', title: '洗濯物を畳む', sub: '5分だけ始める' }
    ]
  });
}

main().finally(async () => prisma.$disconnect());
