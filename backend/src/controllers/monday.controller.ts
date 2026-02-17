/**
 * Monday.com Controller
 *
 * Handles HTTP requests for Monday.com integration
 */

import { Request, Response } from 'express';
import { getMondayService } from '../services/monday.service';
import {
  CreateMondayItemInput,
  UpdateMondayItemInput,
  CreateMondayUpdateInput,
  MondayTestFailureInput,
} from '../types/monday';

export class MondayController {
  /**
   * GET /api/v1/monday/boards
   * Get all accessible Monday boards
   */
  static async getBoards(req: Request, res: Response): Promise<void> {
    try {
      const mondayService = getMondayService();
      const boards = await mondayService.getBoards();

      res.json({
        success: true,
        data: boards,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Monday boards',
      });
    }
  }

  /**
   * GET /api/v1/monday/boards/:boardId
   * Get a specific Monday board
   */
  static async getBoard(req: Request, res: Response): Promise<void> {
    try {
      const boardId = req.params.boardId as string;
      const mondayService = getMondayService();
      const board = await mondayService.getBoard(boardId);

      res.json({
        success: true,
        data: board,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Monday board',
      });
    }
  }

  /**
   * GET /api/v1/monday/boards/:boardId/items
   * Get items from a Monday board
   */
  static async getItems(req: Request, res: Response): Promise<void> {
    try {
      const boardId = req.params.boardId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 25;

      const mondayService = getMondayService();
      const items = await mondayService.getItems(boardId, limit);

      res.json({
        success: true,
        data: items,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Monday items',
      });
    }
  }

  /**
   * POST /api/v1/monday/items
   * Create a new item on a Monday board
   */
  static async createItem(req: Request, res: Response): Promise<void> {
    try {
      const input: CreateMondayItemInput = req.body;

      if (!input.boardId || !input.itemName) {
        res.status(400).json({
          success: false,
          error: 'boardId and itemName are required',
        });
        return;
      }

      const mondayService = getMondayService();
      const item = await mondayService.createItem(input);

      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Monday item',
      });
    }
  }

  /**
   * PUT /api/v1/monday/items/:itemId
   * Update an existing Monday item
   */
  static async updateItem(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId as string;
      const input: Omit<UpdateMondayItemInput, 'itemId'> = req.body;

      if (!input.boardId) {
        res.status(400).json({
          success: false,
          error: 'boardId is required',
        });
        return;
      }

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
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Monday item',
      });
    }
  }

  /**
   * POST /api/v1/monday/items/:itemId/updates
   * Create an update (comment) on a Monday item
   */
  static async createUpdate(req: Request, res: Response): Promise<void> {
    try {
      const itemId = req.params.itemId as string;
      const { body } = req.body;

      if (!body) {
        res.status(400).json({
          success: false,
          error: 'body is required',
        });
        return;
      }

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
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Monday update',
      });
    }
  }

  /**
   * POST /api/v1/monday/test-failures
   * Create a Monday item from a test failure
   */
  static async createItemFromTestFailure(req: Request, res: Response): Promise<void> {
    try {
      const input: MondayTestFailureInput = req.body;

      if (!input.boardId || !input.testRunId || !input.testName || !input.errorMessage) {
        res.status(400).json({
          success: false,
          error: 'boardId, testRunId, testName, and errorMessage are required',
        });
        return;
      }

      const mondayService = getMondayService();
      const item = await mondayService.createItemFromTestFailure(input);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Monday item created successfully from test failure',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Monday item from test failure',
      });
    }
  }

  /**
   * GET /api/v1/monday/boards/:boardId/search
   * Search for items on a Monday board
   */
  static async searchItems(req: Request, res: Response): Promise<void> {
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
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search Monday items',
      });
    }
  }

  /**
   * GET /api/v1/monday/test-connection
   * Test Monday.com API connection
   */
  static async testConnection(req: Request, res: Response): Promise<void> {
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
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test Monday.com connection',
      });
    }
  }
}
