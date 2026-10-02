const db = require('./db');

const categories = [
  { name: 'Income', type: 'income', icon: '💼', color: '#1D9E75' },
  { name: 'Transfers', type: 'expense', icon: '↔️', color: '#0C447C' },
  { name: 'Bills', type: 'expense', icon: '📄', color: '#5F5E5A' },
  { name: 'Groceries', type: 'expense', icon: '🛒', color: '#1D9E75' },
  { name: 'Food & Dining', type: 'expense', icon: '🍽️', color: '#E85D24' },
  { name: 'Transport', type: 'expense', icon: '🚗', color: '#378ADD' },
  { name: 'Shopping', type: 'expense', icon: '🛍️', color: '#D4537E' },
  { name: 'Subscriptions', type: 'expense', icon: '📺', color: '#534AB7' },
  { name: 'Entertainment', type: 'expense', icon: '🎮', color: '#7F77DD' },
  { name: 'Healthcare', type: 'expense', icon: '🏥', color: '#E24B4A' },
  { name: 'Education', type: 'expense', icon: '📚', color: '#378ADD' },
  { name: 'Charity', type: 'expense', icon: '❤️', color: '#D4537E' },
  { name: 'Debt Repayment', type: 'expense', icon: '💸', color: '#B85C38' },
  { name: 'Fees & Charges', type: 'expense', icon: '💳', color: '#888780' },
  { name: 'Cash Withdrawal', type: 'expense', icon: '💵', color: '#888780' },
  { name: 'Government/Legal', type: 'expense', icon: '🏛️', color: '#5F5E5A' },
  { name: 'Other', type: 'expense', icon: '📦', color: '#B4B2A9' },
];

const seedCategories = async () => {
  try {
    for (const cat of categories) {
      await db.query(
        `INSERT INTO categories (name, type, icon, color)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (name) DO NOTHING`,
        [cat.name, cat.type, cat.icon, cat.color]
      );
    }
    console.log(`✅ Seeded ${categories.length} categories`);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
};

seedCategories();