<script lang="ts" setup>
import type { NotifySettings } from '#/api/maixu/notify-settings';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Space,
  Switch,
} from 'ant-design-vue';

import {
  getNotifySettings,
  saveNotifySettings,
  testNotifySettings,
} from '#/api/maixu/notify-settings';
import { appendOperationLog } from '#/api/maixu/operation-log';

const userStore = useUserStore();
const isSuper = computed(() =>
  (userStore.userInfo?.roles || []).includes('super'),
);

const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
const testEmail = ref('');

const form = reactive<NotifySettings>({
  bodyTemplate:
    '你好，\n\n你正在注册 {{app_name}} 账号，本次验证码为：{{code}}\n验证码 {{minutes}} 分钟内有效，请勿泄露给他人。\n\n如果不是你本人操作，请忽略此邮件。',
  configured: false,
  fromEmail: '',
  fromName: '',
  smtpHost: '',
  smtpPassword: '',
  smtpPort: 465,
  smtpUsername: '',
  subjectTemplate: '【{{app_name}}】邮箱验证码',
  useSSL: true,
});

function applySettings(data: NotifySettings) {
  form.bodyTemplate = data.bodyTemplate || form.bodyTemplate;
  form.configured = !!data.configured;
  form.fromEmail = data.fromEmail || '';
  form.fromName = data.fromName || '';
  form.smtpHost = data.smtpHost || '';
  form.smtpPassword = data.smtpPassword || '';
  form.smtpPort = data.smtpPort || 465;
  form.smtpUsername = data.smtpUsername || '';
  form.subjectTemplate = data.subjectTemplate || form.subjectTemplate;
  form.useSSL = data.useSSL !== false;
}

async function loadSettings() {
  if (!isSuper.value) {
    return;
  }

  loading.value = true;
  try {
    const data = await getNotifySettings();
    applySettings(data);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载通知设置失败');
  } finally {
    loading.value = false;
  }
}

function validateForm() {
  if (!form.smtpHost.trim()) {
    message.warning('SMTP Host 不能为空');
    return false;
  }
  if (!form.smtpPort || form.smtpPort < 1 || form.smtpPort > 65_535) {
    message.warning('SMTP Port 不合法');
    return false;
  }
  if (!form.smtpUsername.trim()) {
    message.warning('SMTP Username 不能为空');
    return false;
  }
  if (!form.smtpPassword.trim()) {
    message.warning('SMTP Password 不能为空');
    return false;
  }
  if (!form.fromEmail.trim()) {
    message.warning('From Email 不能为空');
    return false;
  }
  if (!form.fromName.trim()) {
    message.warning('From Name 不能为空');
    return false;
  }
  if (!form.subjectTemplate.trim()) {
    message.warning('Subject 模板不能为空');
    return false;
  }
  if (!form.bodyTemplate.trim()) {
    message.warning('Body 模板不能为空');
    return false;
  }
  return true;
}

async function saveSettings() {
  if (!validateForm()) {
    return;
  }

  saving.value = true;
  try {
    const data = await saveNotifySettings({ ...form });
    applySettings(data);
    await appendOperationLog('系统配置/通知设置', '保存通知设置', {
      fromEmail: form.fromEmail,
      smtpHost: form.smtpHost,
      smtpPort: form.smtpPort,
      smtpUsername: form.smtpUsername,
      useSSL: form.useSSL,
    });
    message.success('通知设置保存成功');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存通知设置失败');
  } finally {
    saving.value = false;
  }
}

async function handleTestEmail() {
  if (!validateForm()) {
    return;
  }
  if (!testEmail.value.trim()) {
    message.warning('请先输入测试邮箱');
    return;
  }

  testing.value = true;
  try {
    await testNotifySettings(testEmail.value.trim());
    await appendOperationLog('系统配置/通知设置', '测试邮件配置', {
      testEmail: testEmail.value,
    });
    message.success('测试邮件发送成功，请检查邮箱');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '测试失败');
  } finally {
    testing.value = false;
  }
}

loadSettings();
</script>

<template>
  <Page
    title="通知设置"
    description="配置邮箱服务与验证码模板，供邮箱注册与验证码通知使用。"
  >
    <Card v-if="!isSuper">
      当前账号不是超级管理员，无法访问通知设置页面。
    </Card>

    <Card v-else :loading="loading" title="邮箱配置">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="form.smtpHost" placeholder="SMTP Host" />
        <InputNumber
          v-model:value="form.smtpPort"
          :max="65535"
          :min="1"
          style="width: 100%"
        />
        <Input v-model:value="form.smtpUsername" placeholder="SMTP Username" />
        <Input.Password
          v-model:value="form.smtpPassword"
          placeholder="SMTP Password"
        />
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">Use SSL</span>
          <Switch v-model:checked="form.useSSL" />
        </div>
        <Input v-model:value="form.fromEmail" placeholder="From Email" />
        <Input v-model:value="form.fromName" placeholder="From Name" />
        <Input
          v-model:value="form.subjectTemplate"
          placeholder="Subject 模板"
        />
      </div>

      <div class="mt-3">
        <Input.TextArea
          v-model:value="form.bodyTemplate"
          :auto-size="{ minRows: 6, maxRows: 12 }"
          placeholder="Body 模板"
        />
      </div>

      <div v-pre class="mt-3 text-xs text-gray-500">
        模板变量支持：{{ app_name }}、{{ code }}、{{ minutes }}
      </div>

      <Space class="mt-4">
        <Button :loading="saving" type="primary" @click="saveSettings">
          保存配置
        </Button>
        <Input
          v-model:value="testEmail"
          allow-clear
          placeholder="测试邮箱"
          style="width: 260px"
        />
        <Button :loading="testing" @click="handleTestEmail">测试邮箱</Button>
      </Space>

      <div class="mt-4">
        <span class="text-sm">当前状态：</span>
        <span :class="form.configured ? 'text-green-600' : 'text-red-500'">
          {{ form.configured ? '已完成配置' : '未完成配置' }}
        </span>
      </div>
    </Card>
  </Page>
</template>
