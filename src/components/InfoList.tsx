"use client";

import { useEffect } from "react";
import {
  useAppKitState,
  useAppKitTheme,
  useAppKitEvents,
  useAppKitAccount,
  useWalletInfo,
} from "@reown/appkit/react";
import { useClientMounted } from "@/hooks/useClientMount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const InfoList = () => {
  const kitTheme = useAppKitTheme();
  const state = useAppKitState();
  const { address, caipAddress, isConnected, embeddedWalletInfo } =
    useAppKitAccount();
  const events = useAppKitEvents();
  const walletInfo = useWalletInfo();
  const mounted = useClientMounted();

  useEffect(() => {
    console.log("Events: ", events);
  }, [events]);

  return !mounted ? null : (
    <div className="grid gap-6 ">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>useAppKit</span>
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid gap-2">
            <div className="flex flex-col md:flex-row justify-between">
              <span className="font-bold">Address:</span>
              <span className="font-mono text-sm">
                {address || "Not connected"}
              </span>
            </div>

            <div className="flex flex-col md:flex-row justify-between">
              <span className="font-bold">Account Type:</span>
              <span>{embeddedWalletInfo?.accountType || "N/A"}</span>
            </div>
          </div>

          {embeddedWalletInfo?.user && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 gap-2">
                {embeddedWalletInfo.user.email && (
                  <>
                    <span className="font-medium">Email:</span>
                    <span>{embeddedWalletInfo.user.email}</span>
                  </>
                )}
                {embeddedWalletInfo.user.username && (
                  <>
                    <span className="font-medium">Username:</span>
                    <span>{embeddedWalletInfo.user.username}</span>
                  </>
                )}
                {embeddedWalletInfo.authProvider && (
                  <>
                    <span className="font-medium">Provider:</span>
                    <span>{embeddedWalletInfo.authProvider}</span>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="font-medium">Theme Mode:</span>
            <Badge variant="outline">{kitTheme.themeMode}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <span className="font-medium">Active Chain:</span>
            <span>{state.activeChain}</span>

            <span className="font-medium">Loading:</span>
            <Badge variant={state.loading ? "default" : "secondary"}>
              {state.loading.toString()}
            </Badge>

            <span className="font-medium">Open:</span>
            <Badge variant={state.open ? "default" : "secondary"}>
              {state.open.toString()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wallet Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="font-medium">Name:</span>
            <span>{walletInfo.walletInfo?.name?.toString() || "N/A"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
