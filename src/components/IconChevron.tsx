export function IconChevron({ open }: { open: boolean }) {
    return (
        <svg
            className={`text-white-40 duration-150 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
            height="6"
            viewBox="0 0 10 6"
            width="10"
        >
            <path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}
