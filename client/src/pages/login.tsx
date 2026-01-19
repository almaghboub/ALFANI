import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/queryClient";
import { loginSchema, type LoginCredentials } from "@shared/schema";
import logoPath from "@assets/ALFANI-removebg-preview_1768829603636.png";

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
      
      // Check for unread messages
      try {
        const response = await apiRequest("GET", "/api/messages/unread-count");
        const unreadData = await response.json() as { count: number };
        
        if (unreadData.count > 0) {
          toast({
            title: t('loginSuccessful'),
            description: `${t('welcomeToLynx')} You have ${unreadData.count} unread message${unreadData.count > 1 ? 's' : ''}. Check the Messages page.`,
          });
        } else {
          toast({
            title: t('loginSuccessful'),
            description: t('welcomeToLynx'),
          });
        }
      } catch {
        // If checking unread messages fails, just show regular login message
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
    <div className="min-h-screen flex items-center justify-center bg-muted/20">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4 mt-6">
            <img src={logoPath} alt="ALFANI Logo" className="h-48 w-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">ALFANI</CardTitle>
          <p className="text-muted-foreground">{t('logisticsManagementSystem')}</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('username')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('enterUsername')}
                        data-testid="input-username"
                        {...field}
                      />
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
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={t('enterPassword')}
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? t('signingIn') : t('signIn')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
