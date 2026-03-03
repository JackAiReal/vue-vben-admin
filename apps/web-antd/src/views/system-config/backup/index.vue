<script lang="ts" setup>
import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Button, Card, Input, Modal, Space, message } from 'ant-design-vue';

import {
  exportSystemBackupSql,
  importSystemBackupSql,
} from '#/api/maixu/backup';
import { appendOperationLog } from '#/api/maixu/operation-log';

const accessStore = useAccessStore();
const userStore = useUserStore();

const isSuper = computed(() =>
  (userStore.userInfo?.roles || []).includes('super'),
);

function hasCode(code: string) {
  const roles = userStore.userInfo?.roles || [];
  if (roles.includes('super')) {
    return true;
  }
  return accessStore.accessCodes.includes(code);
}

const canEditBackup = computed(() => hasCode('MX_BACKUP_EDIT'));

const exporting = ref(false);
const importing = ref(false);
const importConfirmOpen = ref(false);
const sqlText = ref('');
const selectedFileName = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileSelect() {
  fileInputRef.value?.click();
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    if (!text.trim()) {
      message.warning('文件内容为空');
      return;
    }
    sqlText.value = text;
    selectedFileName.value = file.name;
    message.success(`已加载文件：${file.name}`);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '读取文件失败');
  } finally {
    input.value = '';
  }
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/sql;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportSystemBackupSql();
    downloadTextFile(data.filename || 'rbac-backup.sql', data.sql || '');

    await appendOperationLog('系统配置/导出备份', '导出系统配置SQL', {
      filename: data.filename || 'rbac-backup.sql',
      size: Number((data.sql || '').length),
    });

    message.success('导出成功，已下载到本地');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导出失败');
  } finally {
    exporting.value = false;
  }
}

function openImportConfirm() {
  if (!canEditBackup.value) {
    message.warning('当前账号无导入权限');
    return;
  }
  if (!sqlText.value.trim()) {
    message.warning('请先粘贴SQL或选择SQL文件');
    return;
  }
  importConfirmOpen.value = true;
}

async function confirmImport() {
  importing.value = true;
  try {
    const result = await importSystemBackupSql(sqlText.value);

    await appendOperationLog('系统配置/导出备份', '导入系统配置SQL', {
      importedAt: result.importedAt,
      sourceFile: selectedFileName.value || 'manual-input',
    });

    importConfirmOpen.value = false;
    message.success('导入成功，系统配置已覆盖');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '导入失败');
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <Page
    title="导出备份"
    description="导出系统配置SQL到本地，或导入SQL覆盖系统配置。"
  >
    <Card v-if="!isSuper">
      当前账号不是超级管理员，无法访问导出备份页面。
    </Card>

    <template v-else>
      <Card class="mb-4" title="导出系统配置">
        <p class="mb-3 text-sm text-gray-500">
          导出内容包含权限分组、用户、通知配置等系统配置。
        </p>
        <Button type="primary" :loading="exporting" @click="handleExport">
          导出SQL到本地
        </Button>
      </Card>

      <Card title="导入系统配置（覆盖）">
        <p class="mb-3 text-sm text-red-500">
          导入会覆盖当前系统配置数据库，请先执行一次导出备份。
        </p>

        <Space class="mb-3" wrap>
          <Button @click="triggerFileSelect">选择SQL文件</Button>
          <span v-if="selectedFileName" class="text-xs text-gray-500">
            已选文件：{{ selectedFileName }}
          </span>
          <input
            ref="fileInputRef"
            type="file"
            accept=".sql,text/sql"
            style="display: none"
            @change="handleFileChange"
          />
        </Space>

        <Input.TextArea
          v-model:value="sqlText"
          :auto-size="{ minRows: 14, maxRows: 20 }"
          placeholder="可直接粘贴SQL内容，或先选择.sql文件"
        />

        <Button
          class="mt-3"
          danger
          type="primary"
          :disabled="!canEditBackup"
          @click="openImportConfirm"
        >
          导入并覆盖数据库
        </Button>
      </Card>
    </template>

    <Modal
      v-model:open="importConfirmOpen"
      :confirm-loading="importing"
      ok-text="确认覆盖"
      ok-type="danger"
      title="确认导入覆盖"
      @ok="confirmImport"
    >
      该操作会用导入SQL覆盖当前系统配置数据库，且不可撤销。请确认你已做好备份。
    </Modal>
  </Page>
</template>
