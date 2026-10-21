// 系统编号命名空间：联调阶段由环境变量注入，待平台提供获取接口后替换（设计文档 3.1、6.4）
export function resolveSystemNamespace(env: { AXON_CONNECTOR_NAMESPACE?: string } = process.env): string {
  const value = env.AXON_CONNECTOR_NAMESPACE?.trim();
  return value && value.length <= 64 ? value : 'TEST-101';
}
