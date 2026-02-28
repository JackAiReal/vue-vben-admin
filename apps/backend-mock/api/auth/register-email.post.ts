import { eventHandler, readBody } from 'h3';
import { registerByEmail } from '~/utils/rbac-store';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const humanVerified = body?.humanVerified === true;
    if (!humanVerified) {
      return useResponseError('请先完成人机校验');
    }

    const data = registerByEmail({
      code: String(body?.code || '').trim(),
      confirmPassword: String(body?.confirmPassword || ''),
      email: String(body?.email || '').trim(),
      password: String(body?.password || ''),
    });

    return useResponseSuccess(data);
  } catch (error) {
    return useResponseError(
      error instanceof Error ? error.message : '注册失败',
    );
  }
});
