// apps/mobile/components/screen-scroll.tsx
//
// The scroller every screen's main content uses, replacing the kit
// PullToRefresh.native (which drops every ScrollView prop except `style` /
// `contentContainerStyle`, so it could never take native inset behavior).
//
// Insets — why there's no hand-computed bottom padding any more:
//   - iOS: tab screens live inside a UITabBarController (expo-router
//     NativeTabs). `contentInsetAdjustmentBehavior="automatic"` lets UIKit
//     inset the content by the scroll view's safe area, which INCLUDES the
//     translucent tab bar + home indicator — content scrolls behind the
//     glass bar and the last row still clears it. Pushed stack screens get
//     the home-indicator inset the same way.
//   - Android: NativeTabs lays the screen out ABOVE the Material bar, and
//     the edge-to-edge bottom inset is added explicitly for stack screens.
// `bottomGap` is only breathing room after the last row.

import { forwardRef, useCallback, type ReactNode } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "tamagui";

/** Space the FAB needs below scroll content so the last row isn't hidden. */
export const FAB_CLEARANCE = 72;

export type ScreenScrollProps = Omit<ScrollViewProps, "refreshControl"> & {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<unknown>;
  /** Extra space after the content (e.g. FAB_CLEARANCE on screens with a FAB). */
  bottomGap?: number;
  /** Pushed (non-tab) screen: add the Android nav-bar inset ourselves. */
  stackScreen?: boolean;
  /** Fires when the user scrolls within ~1.5 screens of the end (infinite
   *  scroll). Callers guard against duplicate fetches. */
  onEndReached?: () => void;
};

export const ScreenScroll = forwardRef<ScrollView, ScreenScrollProps>(
  function ScreenScroll(
    {
      children,
      refreshing = false,
      onRefresh,
      bottomGap = 24,
      stackScreen = false,
      contentContainerStyle,
      onEndReached,
      onScroll,
      ...rest
    },
    ref,
  ) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const tint = theme.color10?.val ?? theme.color?.val;
    const handleRefresh = useCallback(() => {
      void onRefresh?.();
    }, [onRefresh]);

    const androidStackInset =
      Platform.OS === "android" && stackScreen ? insets.bottom : 0;

    return (
      <ScrollView
        ref={ref}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustsScrollIndicatorInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        {...rest}
        scrollEventThrottle={onEndReached ? 200 : rest.scrollEventThrottle}
        onScroll={(e) => {
          onScroll?.(e);
          if (!onEndReached) return;
          const { layoutMeasurement, contentOffset, contentSize } =
            e.nativeEvent;
          const remaining =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);
          if (remaining < layoutMeasurement.height * 1.5) onEndReached();
        }}
        contentContainerStyle={[
          { paddingBottom: bottomGap + androidStackInset },
          contentContainerStyle,
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={tint}
              colors={tint ? [tint] : undefined}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    );
  },
);
