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

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses statusCode from AppError and returns error shape', () => {
    const { res, status, json } = mockRes();
    const err: AppError = Object.assign(new Error('Bad request'), { statusCode: 400 });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Bad request' });
  });

  it('echoes the message of an intentional 500 AppError', () => {
    const { res, status, json } = mockRes();
    const err: AppError = Object.assign(new Error('Upstream unavailable'), { statusCode: 500 });
    errorHandler(err, req, res, next);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Upstream unavailable' });
  });

  it('defaults to 500 when no statusCode on error', () => {
    const { res, status } = mockRes();
    errorHandler(new Error('Unexpected crash') as AppError, req, res, next);
    expect(status).toHaveBeenCalledWith(500);
  });

  it('does not leak the message of an unexpected error', () => {
    const { res, json } = mockRes();
    errorHandler(new Error('Unexpected crash') as AppError, req, res, next);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Internal Server Error' });
  });

  it('does not leak a Mongo duplicate-key message', () => {
    const { res, json } = mockRes();
    const err = new Error(
      'E11000 duplicate key error collection: authentix.users index: email_1 ' +
        'dup key: { email: "victim@corp.com" }',
    );
    errorHandler(err as AppError, req, res, next);

    const body = json.mock.calls[0][0];
    expect(body).toEqual({ success: false, error: 'Internal Server Error' });
    expect(JSON.stringify(body)).not.toContain('victim@corp.com');
    expect(JSON.stringify(body)).not.toContain('E11000');
  });

  it('logs the real error server-side when it is not an AppError', () => {
    const { res } = mockRes();
    const err = new Error('Unexpected crash');
    errorHandler(err as AppError, req, res, next);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), err);
  });

  it('does not log an intentional AppError', () => {
    const { res } = mockRes();
    const err: AppError = Object.assign(new Error('Bad request'), { statusCode: 400 });
    errorHandler(err, req, res, next);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('falls back to "Internal Server Error" when error has no message', () => {
    const { res, json } = mockRes();
    errorHandler({} as AppError, req, res, next);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'Internal Server Error' });
  });
});
