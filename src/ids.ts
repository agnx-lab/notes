// 场景：Notes 稳定 ID 常量 — 供 store / 贡献注册 / 面板共用，避免 list↔store Require cycle。
export const NOTES_APP_ID = "agnx.notes";
/** 兼容仓内旧常量名。 */
export const DEMO_NOTES_MINI_APP_ID = NOTES_APP_ID;
export const NOTES_SEGMENT_ID = "notes";
export const DEMO_NOTES_SEGMENT_ID = NOTES_SEGMENT_ID;
export const NOTES_PANEL_ID = "editor";
export const DEMO_NOTES_PANEL_ID = NOTES_PANEL_ID;
export const NOTES_PROVIDER_ID = "notes.entries";
export const DEMO_NOTES_PROVIDER_ID = NOTES_PROVIDER_ID;
export const NOTES_NEW_COMMAND_ID = "notes.new";
export const DEMO_NOTES_NEW_COMMAND_ID = NOTES_NEW_COMMAND_ID;
export const NOTES_EXPORT_COMMAND_ID = "notes.export-markdown";
