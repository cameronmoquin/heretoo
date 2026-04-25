/**
 * Shared icon name type. Use anywhere we accept an Ionicons name prop
 * so typos are caught at compile time instead of rendering as a missing
 * glyph at runtime.
 */
import type { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];
