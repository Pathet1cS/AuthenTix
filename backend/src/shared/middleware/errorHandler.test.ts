import { Request, Response, NextFunction } from 'express';
import { errorHandler, AppError } from './errorHandler';

function mockRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, json, status };
}

describe('errorHandler', () => {
  const req = {} as Request;
  const next = jest.fn() as unknown as NextFunction;

  it('uses statusCode from AppError and returns error shape', () => {
    const { res, status, json } = mockRes();
    const err: AppError = Object.assign(new Error('Bad request'), { statusCode: 400 });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Bad request' });
  });

  it('defaults to 500 when no statusCode on error', () => {
    const { res, status, json } = mockRes();
    const err = new Error('Unexpected crash');
    errorHandler(err as AppError, req, res, next);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Unexpected crash' });
  });

  it('falls back to "Internal Server Error" when error has no message', () => {
    const { res, json } = mockRes();
    errorHandler({} as AppError, req, res, next);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Internal Server Error' });
  });
});
