import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/queryClient";
import { loginSchema, type LoginCredentials } from "@shared/schema";
import logoPath from "@assets/alfani-logo.png";
import { Lock, User } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login, isLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      await login(data.username, data.password);
      
      try {
        const response = await apiRequest("GET", "/api/messages/unread-count");
        const unreadData = await response.json() as { count: number };
        
        if (unreadData.count > 0) {
          toast({
            title: t('loginSuccessful'),
            description: `${t('welcomeToLynx')} You have ${unreadData.count} unread message${unreadData.count > 1 ? 's' : ''}.`,
          });
        } else {
          toast({
            title: t('loginSuccessful'),
            description: t('welcomeToLynx'),
          });
        }
      } catch {
        toast({
          title: t('loginSuccessful'),
          description: t('welcomeToLynx'),
        });
      }
      
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: t('loginFailed'),
        description: t('invalidCredentials'),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[hsl(222,47%,11%)]">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-amber-600/10" />
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-20 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-16">
          <img src={logoPath} alt="ALFANI Logo" className="h-40 w-auto mb-8 drop-shadow-2xl brightness-110" />
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight text-center">ALFANI</h1>
          <div className="w-16 h-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full mb-6" />
          <p className="text-white/50 text-sm uppercase tracking-[0.25em] font-medium text-center">Auto Parts & Accessories</p>
          <p className="text-white/30 text-xs mt-2 tracking-wide text-center">Management System</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src={logoPath} alt="ALFANI Logo" className="h-24 w-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground">ALFANI</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] mt-1">Auto Parts & Accessories</p>
          </div>

          <Card className="border-border/50 shadow-xl">
            <CardContent className="p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground tracking-tight">{t('signIn')}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t('logisticsManagementSystem')}</p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('username')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                            <Input
                              placeholder={t('enterUsername')}
                              className="ltr:pl-10 rtl:pr-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                              data-testid="input-username"
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
                        <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('password')}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                            <Input
                              type="password"
                              placeholder={t('enterPassword')}
                              className="ltr:pl-10 rtl:pr-10 h-11 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                              data-testid="input-password"
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
                    className="w-full h-11 font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-900 shadow-lg shadow-amber-500/20 transition-all duration-200"
                    disabled={isLoading}
                    data-testid="button-login"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                        {t('signingIn')}
                      </div>
                    ) : t('signIn')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground/60 mt-6">
            ALFANI Management System v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
