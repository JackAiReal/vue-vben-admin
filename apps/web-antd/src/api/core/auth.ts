import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  /** 登录接口参数 */
  export interface LoginParams {
    account?: string;
    humanVerified?: boolean;
    password?: string;
    username?: string;
  }

  /** 登录接口返回值 */
  export interface LoginResult {
    accessToken: string;
  }

  export interface RefreshTokenResult {
    data: string;
    status: number;
  }

  export interface RegisterByEmailParams {
    code: string;
    confirmPassword: string;
    email: string;
    humanVerified: boolean;
    password: string;
  }

  export interface SendEmailCodeParams {
    appName?: string;
    email: string;
    humanVerified: boolean;
    minutes?: number;
  }
}

/**
 * 登录
 */
export async function loginApi(data: AuthApi.LoginParams) {
  return requestClient.post<AuthApi.LoginResult>('/auth/login', data);
}

/**
 * 刷新accessToken
 */
export async function refreshTokenApi() {
  return baseRequestClient.post<AuthApi.RefreshTokenResult>('/auth/refresh', {
    withCredentials: true,
  });
}

/**
 * 退出登录
 */
export async function logoutApi() {
  return baseRequestClient.post('/auth/logout', {
    withCredentials: true,
  });
}

/**
 * 获取用户权限码
 */
export async function getAccessCodesApi() {
  return requestClient.get<string[]>('/auth/codes');
}

export async function sendEmailCodeApi(data: AuthApi.SendEmailCodeParams) {
  return requestClient.post('/auth/email-code/send', data);
}

export async function registerByEmailApi(data: AuthApi.RegisterByEmailParams) {
  return requestClient.post('/auth/register-email', data);
}
