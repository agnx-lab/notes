// 场景：Notes 宿主引用位 — 避免 insert-image ↔ register-core 循环依赖。
import type { WorkspaceAppHostApi } from "@agnx-lab/app-sdk";

let hostApi: WorkspaceAppHostApi | null = null;

export function bindNotesHostApi(host: WorkspaceAppHostApi | null): void {
  hostApi = host;
}

export function getNotesHost(): WorkspaceAppHostApi | null {
  return hostApi;
}
