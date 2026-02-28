<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref, useTemplateRef } from 'vue';

import { AuthenticationRegister, SliderCaptcha, z } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { registerByEmailApi, sendEmailCodeApi } from '#/api/core/auth';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Register' });

const authStore = useAuthStore();
const loading = ref(false);
const sendingCode = ref(false);
const humanVerified = ref(false);
const CODE_LENGTH = 6;
const SEND_CODE_WINDOW_MS = 10 * 60 * 1000;
const SEND_CODE_CAPTCHA_TRIGGER_COUNT = 3;

const sendCodeTimestamps = ref<number[]>([]);
const registerFormRef = useTemplateRef<any>('registerFormRef');

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(value);
}

function refreshSendCodeTimestamps(now = Date.now()) {
  sendCodeTimestamps.value = sendCodeTimestamps.value.filter(
    (timestamp) => now - timestamp <= SEND_CODE_WINDOW_MS,
  );
}

async function handleSendCode() {
  const now = Date.now();
  refreshSendCodeTimestamps(now);
  const needHumanCheck =
    sendCodeTimestamps.value.length >= SEND_CODE_CAPTCHA_TRIGGER_COUNT;
  if (needHumanCheck && !humanVerified.value) {
    message.warning('发送次数过于频繁，请先完成人机滑块校验');
    return;
  }

  const formApi = registerFormRef.value?.getFormApi?.();
  const values = (await formApi?.getValues?.()) || {};
  const email = String(values.email || '')
    .trim()
    .toLowerCase();
  if (!isValidEmail(email)) {
    message.warning('请先输入正确的邮箱');
    return;
  }

  sendingCode.value = true;
  try {
    await sendEmailCodeApi({
      email,
      humanVerified: true,
      minutes: 10,
    });
    sendCodeTimestamps.value.push(Date.now());
    message.success('验证码已发送，请注意查收邮箱');
  } finally {
    sendingCode.value = false;
  }
}

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入邮箱',
      },
      fieldName: 'email',
      label: '邮箱',
      rules: z
        .string()
        .min(1, { message: '请输入邮箱' })
        .refine((value) => isValidEmail(value), { message: '邮箱格式不正确' }),
    },
    {
      component: 'VbenPinInput',
      componentProps: {
        codeLength: CODE_LENGTH,
        createText: (countdown: number) => {
          return countdown > 0 ? `重新发送(${countdown}s)` : '发送验证码';
        },
        handleSendCode,
        loading: sendingCode.value,
        placeholder: '邮箱验证码',
      },
      fieldName: 'code',
      label: '验证码',
      rules: z
        .string()
        .length(CODE_LENGTH, { message: `请输入${CODE_LENGTH}位验证码` }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: '请输入密码',
      },
      fieldName: 'password',
      label: '密码',
      rules: z.string().min(6, { message: '密码至少6位' }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: '请确认密码',
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ required_error: '请输入确认密码' })
            .min(1, { message: '请输入确认密码' })
            .refine((value) => value === password, {
              message: '两次输入的密码不一致',
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: '确认密码',
    },
  ];
});

async function handleSubmit(value: Recordable<any>) {
  if (!humanVerified.value) {
    message.warning('请先完成人机滑块校验');
    return;
  }

  loading.value = true;
  try {
    const email = String(value.email || '')
      .trim()
      .toLowerCase();
    const password = String(value.password || '');

    await registerByEmailApi({
      code: String(value.code || '').trim(),
      confirmPassword: String(value.confirmPassword || ''),
      email,
      humanVerified: true,
      password,
    });

    message.success('注册成功，正在登录...');

    await authStore.authLogin({
      account: email,
      humanVerified: true,
      password,
      username: email,
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthenticationRegister
    ref="registerFormRef"
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleSubmit"
  >
    <template #before-submit>
      <div class="mb-2 mt-1">
        <div class="mb-2 text-sm text-gray-500">人机校验</div>
        <SliderCaptcha v-model="humanVerified" />
      </div>
    </template>
  </AuthenticationRegister>
</template>
