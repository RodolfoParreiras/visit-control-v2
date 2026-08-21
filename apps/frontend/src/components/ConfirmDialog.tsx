import { CircleAlert } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  destructive = false,
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md overflow-hidden rounded-xl border-slate-200 bg-white p-0 shadow-2xl">
        <AlertDialogHeader className="space-y-4 px-6 pb-2 pt-6 text-left">
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-full',
              destructive
                ? 'bg-red-50 text-red-600'
                : 'bg-[#174f8c]/10 text-[#012c61]',
            )}
          >
            <CircleAlert className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <AlertDialogTitle className="text-xl font-semibold text-[#012c61]">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="leading-6 text-slate-600">
              {description}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4 gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4 sm:space-x-0">
          <AlertDialogCancel
            disabled={isPending}
            className="h-10 rounded-lg border-slate-300 bg-white px-4 text-[#012c61] hover:bg-slate-100"
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={onConfirm}
            className={cn(
              'h-10 rounded-lg border-0 px-4 text-white',
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#012c61] hover:bg-[#01244f]',
            )}
          >
            {isPending ? 'Aguarde...' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
