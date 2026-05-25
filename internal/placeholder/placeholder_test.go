package placeholder

import "testing"

func TestMessage(t *testing.T) {
	got := Message()
	want := "internal placeholder"
	if got != want {
		t.Errorf("Message() = %q, want %q", got, want)
	}
}
