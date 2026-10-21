interface SnackbarMessage {
  textKey: string;
  color: "success" | "error";
}

// One app-wide snackbar (rendered by AppSnackbar in the default layout) for short save/error feedback.
export function useAppSnackbar() {
  const message = useState<SnackbarMessage | null>("app-snackbar", () => null);

  const show = (textKey: string, color: SnackbarMessage["color"]): void => {
    message.value = { textKey, color };
  };

  const hide = (): void => {
    message.value = null;
  };

  return { message: readonly(message), show, hide };
}
