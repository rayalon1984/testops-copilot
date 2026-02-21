import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../../test/test-utils';
import CardActions, { canAct } from './CardActions';
import { Button } from '@mui/material';

describe('CardActions', () => {
    it('renders children for ADMIN role', () => {
        render(
            <CardActions userRole="ADMIN">
                <Button>Action</Button>
            </CardActions>
        );
        expect(screen.getByText('Action')).toBeInTheDocument();
    });

    it('renders children for EDITOR role', () => {
        render(
            <CardActions userRole="EDITOR">
                <Button>Action</Button>
            </CardActions>
        );
        expect(screen.getByText('Action')).toBeInTheDocument();
    });

    it('renders children for USER role (same level as EDITOR)', () => {
        render(
            <CardActions userRole="USER">
                <Button>Action</Button>
            </CardActions>
        );
        expect(screen.getByText('Action')).toBeInTheDocument();
    });

    it('hides children for BILLING role', () => {
        render(
            <CardActions userRole="BILLING">
                <Button>Action</Button>
            </CardActions>
        );
        expect(screen.queryByText('Action')).not.toBeInTheDocument();
    });

    it('hides children for VIEWER role', () => {
        render(
            <CardActions userRole="VIEWER">
                <Button>Action</Button>
            </CardActions>
        );
        expect(screen.queryByText('Action')).not.toBeInTheDocument();
    });

    it('hides children for unknown role', () => {
        render(
            <CardActions userRole="unknown">
                <Button>Action</Button>
            </CardActions>
        );
        expect(screen.queryByText('Action')).not.toBeInTheDocument();
    });
});

describe('canAct', () => {
    it('returns true for ADMIN', () => {
        expect(canAct('ADMIN')).toBe(true);
    });

    it('returns true for EDITOR', () => {
        expect(canAct('EDITOR')).toBe(true);
    });

    it('returns true for USER', () => {
        expect(canAct('USER')).toBe(true);
    });

    it('returns false for BILLING', () => {
        expect(canAct('BILLING')).toBe(false);
    });

    it('returns false for VIEWER', () => {
        expect(canAct('VIEWER')).toBe(false);
    });

    it('handles case-insensitive input', () => {
        expect(canAct('admin')).toBe(true);
        expect(canAct('viewer')).toBe(false);
    });
});
