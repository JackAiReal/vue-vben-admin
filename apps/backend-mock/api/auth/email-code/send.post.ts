import { eventHandler, readBody } from 'h3';
import { sendRegisterEmailCode } from '~/utils/rbac-store';
import { useResponseError, useResponseSuccess } from '~/utils/response';

export default eventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const email = String(body?.email || '').trim();
    const humanVerified = body?.humanVerified === true;

    if (!humanVerified) {
      return useResponseError('请先完成人机校验');
    }

    const data = await sendRegisterEmailCode({
      appName: String(body?.appName || '麦序管理后台'),
      email,
      minutes: Number(body?.minutes || 10),
    });

    return useResponseSuccess(data);
  } catch (error) {
    return useResponseError(
      error instanceof Error ? error.message : '发送验证码失败',
    );
  }
});
