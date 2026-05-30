/**
 * Augmentations for File System Access API types not yet included in
 * TypeScript 5.9's DOM lib.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
 */

interface FileSystemHandle {
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FileSystemHandlePermissionDescriptor {
  mode: "read" | "readwrite"
}

interface Window {
  showDirectoryPicker(options?: FileSystemPickerOptions): Promise<FileSystemDirectoryHandle>
}

interface FileSystemPickerOptions {
  mode?: "read" | "readwrite"
  startIn?: FileSystemHandle | string
  id?: string
}