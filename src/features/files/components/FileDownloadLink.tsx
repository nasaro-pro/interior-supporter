// 권한 재검사 다운로드 링크 (IF-file-download). 서버·클라이언트 어디서나 쓸 수 있는 순수 링크
import type { ReactNode } from 'react';
import { routes } from '@/shared/contracts/routes';
import { linkClass } from '@/shared/ui/styles';

export function FileDownloadLink({
  fileId,
  children,
  download = true,
  uiKey = 'file-download-link',
  className,
}: {
  fileId: string;
  children: ReactNode;
  download?: boolean;
  uiKey?: string;
  className?: string;
}) {
  return (
    <a
      href={routes.file(fileId, { download })}
      data-ui-key={uiKey}
      className={className ?? linkClass}
      rel="noopener"
    >
      {children}
    </a>
  );
}
