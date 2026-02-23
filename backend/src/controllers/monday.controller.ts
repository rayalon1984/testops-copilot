/**
 * Monday.com Controller
 *
 * Handles HTTP requests for Monday.com integration
 */

import { Request, Response, NextFunction } from 'express';
import { getMondayService } from '../services/monday.service';
import {
  CreateMondayItemInput,
  UpdateMondayItemInput,
  MondayTestFailureInput,
} from '../types/monday';
import { safeParseInt } from '@/utils/common';

export class MondayController {
  /**
   * GET /api/v1/monday/boards
   * Get all accessible Monday boards
   */
  static async getBoards(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mondayService = getMondayService();
      const boards = await mondayService.getBoards();

      res.json({
        success: true,
        data: boards,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monday/boards/:boardId
   * Get a specific Monday board
   */
  static async getBoard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const boardId = req.params.boardId as string;
      const mondayService = getMondayService();
      const board = await mondayService.getBoard(boardId);

      res.json({
        success: true,
        data: board,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monday/boards/:boardId/items
   * Get items from a Monday board
   */
  static async getItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const boardId = req.params.boardId as string;
      const limit = safeParseInt(req.query.limit as string | undefined, 25, 1, 500);

      const mondayService = getMondayService();
      const items = await mondayService.getItems(boardId, limit);

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/monday/items
   * Create a new item on a Monday board
   */
  static async createItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: CreateMondayItemInput = req.body;
      const mondayService = getMondayService();
      const item = await mondayService.createItem(input);

      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/monday/items/:itemId
   * Update an existing Monday item
   */
  static async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const itemId = req.params.itemId as string;
      const input: Omit<UpdateMondayItemInput, 'itemId'> = req.body;
      const mondayService = getMondayService();
      const item = await mondayService.updateItem({
        itemId,
        ...input,
      });

      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/monday/items/:itemId/updates
   * Create an update (comment) on a Monday item
   */
  static async createUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const itemId = req.params.itemId as string;
      const { body } = req.body;
      const mondayService = getMondayService();
      const update = await mondayService.createUpdate({
        itemId,
        body,
      });

      res.status(201).json({
        success: true,
        data: update,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/monday/test-failures
   * Create a Monday item from a test failure
   */
  static async createItemFromTestFailure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: MondayTestFailureInput = req.body;
      const mondayService = getMondayService();
      const item = await mondayService.createItemFromTestFailure(input);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Monday item created successfully from test failure',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monday/boards/:boardId/search
   * Search for items on a Monday board
   */
  static async searchItems(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const boardId = req.params.boardId as string;
      const { q } = req.query;

      if (!q) {
        res.status(400).json({
          success: false,
          error: 'Search query (q) is required',
        });
        return;
      }

      const mondayService = getMondayService();
      const items = await mondayService.searchItems(boardId, q as string);

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/monday/test-connection
   * Test Monday.com API connection
   */
  static async testConnection(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const mondayService = getMondayService();
      const isConnected = await mondayService.testConnection();

      if (isConnected) {
        res.json({
          success: true,
          message: 'Monday.com API connection successful',
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Monday.com API connection failed',
        });
      }
    } catch (error) {
      next(error);
    }
  }
}
