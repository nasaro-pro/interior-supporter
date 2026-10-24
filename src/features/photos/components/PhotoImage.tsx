// 사진 이미지 — /api/files/[fileId] 가 권한 재검사 후 60초 서명 URL 로 302 (POL-037)
import { routes } from '@/shared/contracts/routes';
import { cn } from '@/shared/lib/utils';

export function PhotoImage({
  fileId,
  alt,
  className,
  eager = false,
}: {
  fileId: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  return (
    // next/image 는 서명 URL 302 대상(Supabase 도메인)을 next.config(고정 파일) 없이 최적화할 수 없어 img 를 쓴다
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={routes.file(fileId)}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('bg-muted object-cover', className)}
    />
  );
}
