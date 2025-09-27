// This was required because the shadcn/radix-ui scroll area was constantly re-rendering
// using the radix-ui component is preferred but this is a quick fix for now

import { type HTMLAttributes, type ReactNode, forwardRef, useEffect, useRef, useState } from "react";

interface CustomScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode;
	className?: string;
}

const CustomScrollArea = forwardRef<HTMLDivElement, CustomScrollAreaProps>(
	({ children, className = "", ...props }, ref) => {
		const scrollableRef = useRef<HTMLDivElement>(null);
		const [showScrollbar, setShowScrollbar] = useState(false);
		const [scrollInfo, setScrollInfo] = useState({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 });

		useEffect(() => {
			// Add global style to hide scrollbars, quick and dirty but whatever
			const styleId = "hide-scrollbar-style";

			if (!document.getElementById(styleId)) {
				const style = document.createElement("style");
				style.id = styleId;
				style.textContent = `
					.hide-scrollbars::-webkit-scrollbar {
						display: none;
						width: 0;
						height: 0;
					}
				`;
				document.head.appendChild(style);
			}

			// Handle scroll events to update scrollbar position
			const scrollable = scrollableRef.current;
			if (!scrollable) return;

			const updateScrollInfo = () => {
				setScrollInfo({
					scrollTop: scrollable.scrollTop,
					scrollHeight: scrollable.scrollHeight,
					clientHeight: scrollable.clientHeight,
				});
			};

			updateScrollInfo();

			scrollable.addEventListener("scroll", updateScrollInfo);

			const resizeObserver = new ResizeObserver(updateScrollInfo);
			resizeObserver.observe(scrollable);

			return () => {
				scrollable.removeEventListener("scroll", updateScrollInfo);
				resizeObserver.disconnect();
			};
		}, []);

		// Calculate scrollbar dimensions
		const scrollbarHeight =
			scrollInfo.scrollHeight > 0
				? Math.max(20, (scrollInfo.clientHeight / scrollInfo.scrollHeight) * scrollInfo.clientHeight)
				: 0;

		const scrollbarTop =
			scrollInfo.scrollHeight > 0
				? (scrollInfo.scrollTop / (scrollInfo.scrollHeight - scrollInfo.clientHeight)) *
					(scrollInfo.clientHeight - scrollbarHeight)
				: 0;

		const isScrollable = scrollInfo.scrollHeight > scrollInfo.clientHeight;

		return (
			<div
				ref={ref}
				className={`relative h-full w-full ${className}`}
				{...props}
				onMouseEnter={() => setShowScrollbar(true)}
				onMouseLeave={() => setShowScrollbar(false)}
			>
				<div
					ref={scrollableRef}
					className="hide-scrollbars absolute inset-0 overflow-y-auto overflow-x-hidden"
					style={{
						scrollbarWidth: "none",
						msOverflowStyle: "none",
						WebkitOverflowScrolling: "touch",
					}}
				>
					<div className="h-fit min-h-full w-full">{children}</div>
				</div>

				{isScrollable && showScrollbar && (
					<div
						className={`absolute top-0 right-0 w-2 h-full z-50 pointer-events-none ${showScrollbar ? "opacity-80" : "opacity-0"}`}
					>
						<div
							className="absolute bg-gray-300 w-2 rounded-full right-[2px]"
							style={{
								height: `${scrollbarHeight}px`,
								top: `${scrollbarTop}px`,
							}}
						/>
					</div>
				)}
			</div>
		);
	},
);

CustomScrollArea.displayName = "CustomScrollArea";

export { CustomScrollArea };
