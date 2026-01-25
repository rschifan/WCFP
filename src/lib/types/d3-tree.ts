/**
 * Type definitions for D3 tree visualization
 */

import type { HierarchyPointNode, HierarchyPointLink } from 'd3-hierarchy';
import type { TaxonomicRank } from './taxonomy';

/**
 * Base data for tree nodes
 */
export interface TreeNodeData {
	name: string;
	rank?: TaxonomicRank;
	count: number;
	children?: TreeNodeData[];
	_children?: TreeNodeData[];
	path?: string;
	wcfpId?: number;
}

/**
 * Load more placeholder node
 */
export interface LoadMoreNode {
	__loadMore: true;
	startIndex: number;
	totalRemaining: number;
	parentPath: string;
}

/**
 * Type guard for load-more nodes
 */
export function isLoadMoreNode(node: unknown): node is LoadMoreNode {
	return (
		typeof node === 'object' &&
		node !== null &&
		'__loadMore' in node &&
		(node as LoadMoreNode).__loadMore === true
	);
}

/**
 * D3 hierarchy node with position data
 */
export type D3TreeNode = HierarchyPointNode<TreeNodeData>;

/**
 * D3 hierarchy link with position data
 */
export type D3TreeLink = HierarchyPointLink<TreeNodeData>;

/**
 * Node path from root to a specific node
 */
export type NodePath = D3TreeNode[];

/**
 * Visual state of a node
 */
export interface NodeState {
	isSelected: boolean;
	isHovered: boolean;
	isExpanded: boolean;
	isInSelectedPath: boolean;
}

/**
 * Transform state for zoom/pan
 */
export interface TransformState {
	x: number;
	y: number;
	k: number;
}

/**
 * Label position relative to node
 */
export type LabelPosition = 'left' | 'right';

/**
 * Props for D3TreeNode rendering
 */
export interface D3TreeNodeProps {
	node: D3TreeNode;
	state: NodeState;
	onClick?: (node: D3TreeNode) => void;
	onHover?: (node: D3TreeNode | null) => void;
}
