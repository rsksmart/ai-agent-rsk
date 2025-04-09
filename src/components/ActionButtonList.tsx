'use client'
import { useDisconnect, useAppKit  } from '@reown/appkit/react'
import { Button } from './ui/button';

export const ActionButtonList = () => {
    const { disconnect } = useDisconnect();
    const { open } = useAppKit();

    const handleDisconnect = async () => {
      try {
        await disconnect();
      } catch (error) {
        console.error("Failed to disconnect:", error);
      }
    }
  return (
    <div className='space-x-5'>
        <Button onClick={() => open()}>Open</Button>
        <Button onClick={handleDisconnect}>Disconnect</Button>
    </div>
  )
}
