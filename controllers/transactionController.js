const Transaction = require('../models/Transaction');

// @desc    Get all transactions for the logged-in user (with filtering, sorting, pagination)
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      category,
      search,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = 'date',
      sortOrder = 'desc',
    } = req.query;

    // Build filter object
    const filter = { userId: req.user._id };

    if (type && ['income', 'expense'].includes(type)) {
      filter.type = type;
    }

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
    }

    // Build sort object
    const allowedSortFields = ['date', 'amount', 'type', 'description', 'createdAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    // Pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Execute queries in parallel
    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Transaction.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions.',
    });
  }
};

// @desc    Create a new transaction
// @route   POST /api/transactions
// @access  Private
const createTransaction = async (req, res) => {
  try {
    const { type, description, amount, category, date, notes } = req.body;

    if (!type || !description || !amount || !category || !date) {
      return res.status(400).json({
        success: false,
        message: 'Type, description, amount, category, and date are required.',
      });
    }

    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "income" or "expense".',
      });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number.',
      });
    }

    const transaction = await Transaction.create({
      userId: req.user._id,
      type,
      description: description.trim(),
      amount: parseFloat(amount),
      category,
      date: new Date(date),
      notes: notes ? notes.trim() : '',
    });

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully!',
      data: transaction,
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction.',
    });
  }
};

// @desc    Get single transaction by ID
// @route   GET /api/transactions/:id
// @access  Private
const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.',
      });
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Get transaction by ID error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction.',
    });
  }
};

// @desc    Update a transaction
// @route   PUT /api/transactions/:id
// @access  Private
const updateTransaction = async (req, res) => {
  try {
    const { type, description, amount, category, date, notes } = req.body;

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.',
      });
    }

    // Validate
    if (type && !['income', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either "income" or "expense".',
      });
    }

    if (amount && (isNaN(amount) || parseFloat(amount) <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number.',
      });
    }

    // Update fields
    if (type) transaction.type = type;
    if (description) transaction.description = description.trim();
    if (amount) transaction.amount = parseFloat(amount);
    if (category) transaction.category = category;
    if (date) transaction.date = new Date(date);
    if (notes !== undefined) transaction.notes = notes.trim();

    await transaction.save();

    res.status(200).json({
      success: true,
      message: 'Transaction updated successfully!',
      data: transaction,
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update transaction.',
    });
  }
};

// @desc    Delete a transaction
// @route   DELETE /api/transactions/:id
// @access  Private
const deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully!',
    });
  } catch (error) {
    console.error('Delete transaction error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid transaction ID.',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to delete transaction.',
    });
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
};
