'use strict';

const FilterService = require('../services/filter.service');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const filterService = new FilterService();

const getAllFilters = catchAsync(async (req, res, next) => {
  try {
    const { categorySlug } = req.query;
    const filters = await filterService.getAllFilterData(categorySlug);
    res.status(200).json(filters); // filterService.getAllFilterData already returns { success: true, data: ... }
  } catch (error) {
    next(new AppError(error));
  }
});

const getCategories = catchAsync(async (req, res, next) => {
  try {
    const categories = await filterService.getCategories();
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(new AppError(error));
  }
});

const getPriceRange = catchAsync(async (req, res, next) => {
  try {
    const priceRange = await filterService.getPriceRange();
    res.status(200).json({
      success: true,
      data: priceRange,
    });
  } catch (error) {
    next(new AppError(error));
  }
});

const getColors = catchAsync(async (req, res, next) => {
  try {
    const colors = await filterService.getColors();
    res.status(200).json({
      success: true,
      data: colors,
    });
  } catch (error) {
    next(new AppError(error));
  }
});

const getSizes = catchAsync(async (req, res, next) => {
  try {
    const sizes = await filterService.getSizes();
    res.status(200).json({
      success: true,
      data: sizes,
    });
  } catch (error) {
    next(new AppError(error));
  }
});

const getDressStyles = catchAsync(async (req, res, next) => {
  try {
    const dressStyles = await filterService.getDressStyles();
    res.status(200).json({
      success: true,
      data: dressStyles,
    });
  } catch (error) {
    next(new AppError(error));
  }
}); 

const getFilteredProducts = catchAsync(async (req, res, next) => {
  try {
    const { body } = req;
    const products = await filterService.getFilteredProducts(body);
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(new AppError(error));
  }
});

const getProductCombinations = catchAsync(async (req, res, next) => {
  try {
    const { productId } = req.params;
    const combinations = await filterService.getProductCombinations(productId);
    res.status(200).json({
      success: true,
      data: combinations,
    });
  } catch (error) {
    next(new AppError(error));
  }
});

module.exports = {
  getAllFilters,
  getCategories,
  getPriceRange,
  getColors,
  getSizes,
  getDressStyles,
  getFilteredProducts,
  getProductCombinations,
};
