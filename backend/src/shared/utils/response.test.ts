import { Response } from 'express';
import { sendSuccess, sendError } from './response';

function mockRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status } as unknown as Response, json, status };
}

describe('sendSuccess', () => {
  it('responds with 200 and success: true by default', () => {
    const { res, status, json } = mockRes();
    sendSuccess(res, { id: 1 });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
  });

  it('uses the provided status code', () => {
    const { res, status } = mockRes();
    sendSuccess(res, null, 201);
    expect(status).toHaveBeenCalledWith(201);
  });
});

describe('sendError', () => {
  it('responds with 500 and success: false by default', () => {
    const { res, status, json } = mockRes();
    sendError(res, 'something went wrong');
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'something went wrong' });
  });

  it('uses the provided status code', () => {
    const { res, status } = mockRes();
    sendError(res, 'not found', 404);
    expect(status).toHaveBeenCalledWith(404);
  });
});
