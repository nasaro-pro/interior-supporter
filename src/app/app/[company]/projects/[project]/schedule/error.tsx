'use client';
import { RouteError } from '@/shared/ui/route-error';

export default function SegmentError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} screenId="PM-08" />;
}
