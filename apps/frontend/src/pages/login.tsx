import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLogin } from '@visit-control/api-client';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, KeyRound, Loader2, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const loginSchema = z.object({
  login: z.string().min(1, 'Usuário é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [, navigate] = useLocation();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (result) => {
        login(result.token, result.user);
        navigate('/dashboard');
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Falha na autenticação",
          description: error?.response?.data?.error || "Usuário ou senha incorretos. Tente novamente.",
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-primary text-primary-foreground p-4 rounded-xl shadow-lg mb-4">
            <Building2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Controle de Visitantes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wider font-semibold">
            Prefeitura Municipal de Paraíba do Sul
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-gray-100">Acesso ao Sistema</h2>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="login"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-gray-300">Usuário</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute left-3 top-2.5 text-gray-400">
                            <UserRound className="w-5 h-5" />
                          </div>
                          <Input 
                            placeholder="Digite seu login" 
                            className="pl-10 h-11 bg-gray-50/50 dark:bg-gray-800/50" 
                            autoCapitalize="none"
                            autoComplete="off"
                            autoCorrect="off"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700 dark:text-gray-300">Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <div className="absolute left-3 top-2.5 text-gray-400">
                            <KeyRound className="w-5 h-5" />
                          </div>
                          <Input 
                            type="password" 
                            placeholder="Digite sua senha" 
                            className="pl-10 h-11 bg-gray-50/50 dark:bg-gray-800/50"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-11 text-base font-semibold shadow-md"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>
              </form>
            </Form>
          </div>
          
          {/* Footer security note */}
          <div className="bg-gray-50 dark:bg-gray-800/50 px-8 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Acesso restrito a funcionários autorizados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
