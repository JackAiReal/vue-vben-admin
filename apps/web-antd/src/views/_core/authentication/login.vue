<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, ref } from 'vue';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { message } from 'ant-design-vue';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const humanVerified = ref(false);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: '请输入邮箱或用户名',
      },
      fieldName: 'username',
      label: '邮箱/用户名',
      rules: z.string().min(1, { message: '请输入邮箱或用户名' }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.password'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
  ];
});

async function handleSubmit(values: Recordable<any>) {
  if (!humanVerified.value) {
    message.warning('请先完成人机滑块校验');
    return;
  }

  await authStore.authLogin({
    account: String(values.username || '').trim(),
    humanVerified: true,
    password: String(values.password || ''),
    username: String(values.username || '').trim(),
  });
}
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="true"
    :show-third-party-login="false"
    @submit="handleSubmit"
  >
    <template #before-submit>
      <div class="mb-3 mt-1">
        <div class="mb-2 text-sm text-gray-500">人机校验</div>
        <SliderCaptcha v-model="humanVerified" />
      </div>
    </template>
  </AuthenticationLogin>
</template>
