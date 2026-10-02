const Transaction = require('../models/Transaction');

// @desc    Get dashboard summary for logged-in user
// @route   GET /api/dashboard/summary
// @access  Private
const getDashboardSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    // Current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Aggregate all-time totals
    const allTimeTotals = await Transaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Aggregate current month totals
    const currentMonthTotals = await Transaction.aggregate([
      { $match: { userId, date: { $gte: startOfMonth, $lte: endOfMonth } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Monthly breakdown for the past 6 months
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyData = await Transaction.aggregate([
      { $match: { userId, date: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type',
          },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Category breakdown for expenses (current month)
    const expensesByCategory = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: 'expense',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Recent 5 transactions
    const recentTransactions = await Transaction.find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .lean();

    // Process totals
    const totals = { income: 0, expense: 0 };
    allTimeTotals.forEach((t) => {
      totals[t._id] = t.total;
    });

    const monthTotals = { income: 0, expense: 0 };
    currentMonthTotals.forEach((t) => {
      monthTotals[t._id] = t.total;
    });

    // Process monthly data into chart-friendly format
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyChartData = {};

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      monthlyChartData[key] = {
        month: monthNames[d.getMonth()],
        year: d.getFullYear(),
        income: 0,
        expense: 0,
      };
    }

    monthlyData.forEach((item) => {
      const key = `${item._id.year}-${item._id.month}`;
      if (monthlyChartData[key]) {
        monthlyChartData[key][item._id.type] = item.total;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        totalIncome: totals.income,
        totalExpense: totals.expense,
        totalBalance: totals.income - totals.expense,
        monthIncome: monthTotals.income,
        monthExpense: monthTotals.expense,
        monthSavings: monthTotals.income - monthTotals.expense,
        monthlyChart: Object.values(monthlyChartData),
        expensesByCategory,
        recentTransactions,
        currentMonth: monthNames[now.getMonth()],
        currentYear: now.getFullYear(),
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard summary.',
    });
  }
};

module.exports = { getDashboardSummary };
